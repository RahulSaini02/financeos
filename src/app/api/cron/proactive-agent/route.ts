/**
 * GET /api/cron/proactive-agent
 * Runs at 6pm PT (2:00 UTC next day). For each user with push subscriptions
 * and ai_enabled=true, runs a lightweight analysis checking:
 *   1. Budgets ≥ 70% spent with ≥ 10 days left in the month
 *   2. Savings goals behind target pace
 *   3. Category spend this month > 150% of 3-month average
 *
 * Sends up to 2 push notifications per user per day.
 * Cleans up stale (410/404) subscriptions.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  or  x-cron-secret header
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'
import { getUserPrompt } from '@/lib/get-user-prompt'
import { getAppSetting } from '@/lib/get-app-setting'
import { sendPushNotification } from '@/lib/push-notifications'

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

interface ProactiveFinding {
  title: string
  body: string
  url: string
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const auth =
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    request.headers.get('x-cron-secret') ??
    ''
  if (auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic not configured' }, { status: 500 })
  }

  const supabase = createServiceClient()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeftInMonth = lastDayOfMonth.getDate() - now.getDate()

  // Three months ago for historical average
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const aiModel = await getAppSetting(supabase, 'ai_model_daily_insight', 'claude-haiku-4-5-20251001')

  // Fetch all users with push subscriptions
  const { data: subscriptionRows, error: subsErr } = await supabase
    .from('user_push_subscriptions')
    .select('user_id, id, endpoint, p256dh, auth')

  if (subsErr) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }

  type SubRow = { user_id: string; id: string; endpoint: string; p256dh: string; auth: string }
  const byUser = new Map<string, SubRow[]>()
  for (const row of subscriptionRows ?? []) {
    const r = row as SubRow
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, [])
    byUser.get(r.user_id)!.push(r)
  }

  const results: { userId: string; status: string; findings?: number }[] = []

  for (const [userId, userSubs] of byUser) {
    try {
      // Check ai_enabled (+ persona for mismatch nudges; column exists since migration 031)
      let aiEnabled = false
      let persona: string | null = null
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('ai_enabled, persona')
        .eq('id', userId)
        .maybeSingle()
      if (profileErr) {
        // Pre-031 fallback: persona column may not exist yet
        const { data: fallback } = await supabase
          .from('profiles')
          .select('ai_enabled')
          .eq('id', userId)
          .maybeSingle()
        aiEnabled = fallback?.ai_enabled ?? false
      } else {
        aiEnabled = profile?.ai_enabled ?? false
        persona = (profile?.persona as string | null) ?? null
      }
      if (!aiEnabled) continue

      // ── 1. Budget trajectory: ≥ 70% spent with ≥ 10 days left ──────────────
      const { data: budgets } = await supabase
        .from('budgets')
        .select('amount_usd, category:categories(id, name)')
        .eq('user_id', userId)
        .eq('month', firstDayOfMonth)

      type BudgetRow = { amount_usd: number; category: { id: string; name: string } | null }
      const budgetFindings: string[] = []

      if (budgets && budgets.length > 0 && daysLeftInMonth >= 10) {
        // One query for all budgeted categories, grouped in JS (avoids N+1 per budget)
        const budgetCatIds = (budgets as unknown as BudgetRow[])
          .map((b) => b.category?.id)
          .filter((id): id is string => Boolean(id))

        const { data: budgetTxns } = await supabase
          .from('transactions')
          .select('amount_usd, category_id')
          .eq('user_id', userId)
          .eq('cr_dr', 'debit')
          .in('category_id', budgetCatIds)
          .gte('date', firstDayOfMonth)
          .lte('date', todayStr)

        const spentByCategory = new Map<string, number>()
        for (const t of (budgetTxns ?? []) as { amount_usd: number; category_id: string | null }[]) {
          if (!t.category_id) continue
          spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + Math.abs(t.amount_usd))
        }

        for (const budget of budgets as unknown as BudgetRow[]) {
          const cat = budget.category
          if (!cat) continue

          const spent = spentByCategory.get(cat.id) ?? 0
          const pct = budget.amount_usd > 0 ? (spent / budget.amount_usd) * 100 : 0

          if (pct >= 70 && pct < 100) {
            budgetFindings.push(
              `${cat.name}: ${pct.toFixed(0)}% spent ($${spent.toFixed(2)} of $${budget.amount_usd.toFixed(2)}), ${daysLeftInMonth} days left`
            )
          }
        }
      }

      // ── 2. Savings goal velocity ─────────────────────────────────────────────
      const { data: goals } = await supabase
        .from('savings_goals')
        .select('name, target_amount, current_amount, monthly_contribution, created_at')
        .eq('user_id', userId)
        .eq('status', 'active')

      type GoalRow = {
        name: string
        target_amount: number
        current_amount: number
        monthly_contribution: number
        created_at: string
      }
      const goalFindings: string[] = []

      for (const goal of (goals ?? []) as GoalRow[]) {
        if (!goal.monthly_contribution || goal.monthly_contribution <= 0) continue
        const remaining = goal.target_amount - goal.current_amount
        if (remaining <= 0) continue

        // Months since goal creation
        const createdAt = new Date(goal.created_at)
        const monthsElapsed =
          (now.getFullYear() - createdAt.getFullYear()) * 12 +
          (now.getMonth() - createdAt.getMonth())

        if (monthsElapsed <= 0) continue
        const expectedByNow = goal.monthly_contribution * monthsElapsed
        const behindBy = expectedByNow - goal.current_amount

        if (behindBy > 0 && behindBy > goal.monthly_contribution * 0.5) {
          goalFindings.push(
            `${goal.name}: $${goal.current_amount.toFixed(0)} saved, expected $${expectedByNow.toFixed(0)} by now (behind by $${behindBy.toFixed(0)})`
          )
        }
      }

      // ── 3. Unusual spending: category > 150% of 3-month avg ─────────────────
      const { data: currentMonthTxns } = await supabase
        .from('transactions')
        .select('amount_usd, category_id, category:categories(name)')
        .eq('user_id', userId)
        .eq('cr_dr', 'debit')
        .eq('is_internal_transfer', false)
        .gte('date', firstDayOfMonth)
        .lte('date', todayStr)

      const { data: historicalTxns } = await supabase
        .from('transactions')
        .select('amount_usd, category_id, date')
        .eq('user_id', userId)
        .eq('cr_dr', 'debit')
        .eq('is_internal_transfer', false)
        .gte('date', threeMonthsAgoStr)
        .lte('date', endOfLastMonth)

      type TxnWithCat = { amount_usd: number; category_id: string | null; category: unknown }
      type HistoricalTxn = { amount_usd: number; category_id: string | null; date: string }

      // Current month spend per category
      const currentSpend = new Map<string, { name: string; amount: number }>()
      for (const t of (currentMonthTxns ?? []) as TxnWithCat[]) {
        if (!t.category_id) continue
        const catObj = t.category as { name?: string } | Array<{ name?: string }> | null
        const name =
          Array.isArray(catObj)
            ? (catObj[0]?.name ?? 'Unknown')
            : (catObj as { name?: string } | null)?.name ?? 'Unknown'
        const existing = currentSpend.get(t.category_id)
        if (existing) existing.amount += Math.abs(t.amount_usd)
        else currentSpend.set(t.category_id, { name, amount: Math.abs(t.amount_usd) })
      }

      // 3-month average per category
      const historicalSpend = new Map<string, number>()
      for (const t of (historicalTxns ?? []) as HistoricalTxn[]) {
        if (!t.category_id) continue
        historicalSpend.set(t.category_id, (historicalSpend.get(t.category_id) ?? 0) + Math.abs(t.amount_usd))
      }

      const anomalyFindings: string[] = []
      for (const [catId, { name, amount }] of currentSpend) {
        const historicalTotal = historicalSpend.get(catId) ?? 0
        const monthlyAvg = historicalTotal / 3
        if (monthlyAvg > 0 && amount > monthlyAvg * 1.5) {
          const pctAbove = ((amount - monthlyAvg) / monthlyAvg) * 100
          anomalyFindings.push(
            `${name}: $${amount.toFixed(0)} this month vs $${monthlyAvg.toFixed(0)} avg (${pctAbove.toFixed(0)}% above normal)`
          )
        }
      }

      // ── 4. Persona/pattern mismatch nudges ───────────────────────────────────
      // The persona chosen at onboarding hides some tabs by default. When the data
      // says otherwise (e.g. a Student with regular paychecks), suggest enabling
      // the hidden tab — the tab is never locked, just hidden.
      const personaNudges: string[] = []
      if (persona === 'student' || persona === 'between_jobs') {
        const [{ count: paycheckCount }, { count: investmentCount }] = await Promise.all([
          supabase.from('paychecks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('investments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        ])
        if ((paycheckCount ?? 0) >= 2) {
          personaNudges.push(
            `User persona is "${persona}" (Paychecks tab hidden by default) but has ${paycheckCount} paycheck records — suggest enabling the Paychecks tab in Settings`
          )
        }
        if ((investmentCount ?? 0) >= 1) {
          personaNudges.push(
            `User persona is "${persona}" (Investments tab hidden by default) but has ${investmentCount} investment holdings — suggest enabling the Investments tab in Settings`
          )
        }
      }

      // ── Build snapshot for Anthropic ──────────────────────────────────────────
      const snapshot = JSON.stringify({
        date: todayStr,
        days_left_in_month: daysLeftInMonth,
        budget_warnings: budgetFindings,
        savings_goal_alerts: goalFindings,
        spending_anomalies: anomalyFindings,
        persona_nudges: personaNudges,
      })

      // Get prompt template
      const promptTemplate = await getUserPrompt(
        supabase,
        userId,
        'proactive_analysis',
        DEFAULT_PROMPTS.proactive_analysis.content
      )
      const prompt = promptTemplate.replaceAll('{{snapshot}}', snapshot)

      const message = await anthropic.messages.create({
        model: aiModel,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })

      const rawResponse = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'

      let findings: ProactiveFinding[] = []
      try {
        const parsed: unknown = JSON.parse(rawResponse)
        if (Array.isArray(parsed)) {
          findings = (parsed as ProactiveFinding[])
            .filter(
              (f) =>
                f &&
                typeof f.title === 'string' &&
                typeof f.body === 'string' &&
                typeof f.url === 'string'
            )
            .slice(0, 2)
        }
      } catch {
        // Model returned non-JSON — skip this user
        results.push({ userId, status: 'parse-error' })
        continue
      }

      if (findings.length === 0) {
        results.push({ userId, status: 'no-findings' })
        continue
      }

      // Send up to 2 push notifications per user
      const staleIds: string[] = []
      let sent = 0

      for (const finding of findings) {
        for (const sub of userSubs) {
          try {
            const result = await sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              {
                title: finding.title,
                body: finding.body,
                url: finding.url,
                tag: `proactive-${todayStr}-${finding.title.toLowerCase().replace(/\s+/g, '-')}`,
              }
            )
            if (result.gone) {
              if (!staleIds.includes(sub.id)) staleIds.push(sub.id)
            } else {
              sent++
            }
          } catch {
            // Non-fatal per subscription
          }
        }
      }

      // Clean up stale subscriptions
      if (staleIds.length > 0) {
        await supabase
          .from('user_push_subscriptions')
          .delete()
          .in('id', staleIds)
      }

      results.push({ userId, status: 'ok', findings: sent })
    } catch (err) {
      console.error(`proactive-agent cron error for user ${userId}:`, err)
      results.push({ userId, status: 'error' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
