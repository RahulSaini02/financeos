import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'
import { getUserPrompt } from '@/lib/get-user-prompt'
import { getUserModel } from '@/lib/get-user-model'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORY_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#64748b']

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check ai_enabled — used later to gate insight generation (non-AI parts always run)
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('ai_enabled')
      .eq('id', user.id)
      .maybeSingle()
    const aiEnabled = profileRow?.ai_enabled ?? false

    const aiModel = aiEnabled ? await getUserModel(supabase, user.id) : ''

    const now = new Date()
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const todayStr = now.toISOString().split('T')[0]

    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0]

    const pad = (n: number) => String(n).padStart(2, '0')

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthFirstDay = `${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}-01`
    const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    // 12-month window for monthly comparison chart
    const twelveMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const twelveMonthsAgoStr = `${twelveMonthsAgoDate.getFullYear()}-${pad(twelveMonthsAgoDate.getMonth() + 1)}-01`

    const thirtyDaysFromNow = new Date(now)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0]

    const [
      accountsRes,
      transactionsRes,
      flaggedRes,
      networthRes,
      insightRes,
      billsRes,
      prevTransactionsRes,
      twelveMonthTxnsRes,
      calendarEventsRes,
    ] = await Promise.all([
      supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('transactions')
        .select('*, category:categories(name)')
        .eq('user_id', user.id)
        .gte('date', firstDay)
        .lte('date', lastDay),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('flagged', true),
      supabase
        .from('networth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('month', { ascending: false })
        .limit(12),
      supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('subscriptions')
        .select('name, next_billing_date, billing_cost')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('next_billing_date', 'is', null)
        .gte('next_billing_date', todayStr)
        .lte('next_billing_date', sevenDaysStr)
        .order('next_billing_date', { ascending: true }),
      // prev month — still needed for AI monthly summary category breakdown
      supabase
        .from('transactions')
        .select('amount_usd, cr_dr, is_internal_transfer')
        .eq('user_id', user.id)
        .gte('date', prevMonthFirstDay)
        .lte('date', prevMonthLastDay),
      // single 12-month aggregate for the comparison chart
      supabase
        .from('transactions')
        .select('amount_usd, cr_dr, date')
        .eq('user_id', user.id)
        .eq('is_internal_transfer', false)
        .gte('date', twelveMonthsAgoStr)
        .lte('date', lastDay),
      // upcoming financial calendar events (next 30 days)
      supabase
        .from('calendar_events')
        .select('title, start_date, estimated_cost, is_bill_reminder')
        .eq('user_id', user.id)
        .gte('start_date', todayStr)
        .lte('start_date', thirtyDaysStr)
        .or('is_bill_reminder.eq.true,estimated_cost.not.is.null')
        .order('start_date', { ascending: true })
        .limit(5),
    ])

    const accounts = accountsRes.data ?? []
    const transactions = transactionsRes.data ?? []
    const flagged_count = flaggedRes.count ?? 0
    const snapshots = networthRes.data ?? []
    let latest_insight = insightRes.data?.[0] ?? null
    const bills = billsRes.data ?? []
    const upcomingCalendarEvents = calendarEventsRes.data ?? []

    const total_assets = accounts
      .filter((a) => a.kind === 'asset' || a.kind === 'investment')
      .reduce((sum, a) => sum + (a.current_balance ?? 0), 0)

    const total_liabilities = accounts
      .filter((a) => a.kind === 'liability')
      .reduce((sum, a) => sum + Math.abs(a.current_balance ?? 0), 0)

    const net_worth = total_assets - total_liabilities

    const monthly_income = transactions
      .filter((t) => t.cr_dr === 'credit' && !t.is_internal_transfer)
      .reduce((sum, t) => sum + Math.abs(t.amount_usd ?? 0), 0)

    const monthly_expenses = transactions
      .filter((t) => t.cr_dr === 'debit' && !t.is_internal_transfer)
      .reduce((sum, t) => sum + Math.abs(t.amount_usd ?? 0), 0)

    const savings_rate =
      monthly_income > 0
        ? ((monthly_income - monthly_expenses) / monthly_income) * 100
        : 0

    const upcoming_bills = bills.map((b) => ({
      name: b.name,
      due_date: b.next_billing_date,
      amount: b.billing_cost,
      paid: false,
    }))

    // ── Category breakdown for pie chart ────────────────────────────────────────
    const catSpend: Record<string, number> = {}
    for (const t of transactions) {
      if (t.cr_dr === 'debit' && !t.is_internal_transfer) {
        const catName = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
        catSpend[catName] = (catSpend[catName] ?? 0) + Math.abs(t.amount_usd ?? 0)
      }
    }
    const sortedCats = Object.entries(catSpend).sort((a, b) => b[1] - a[1])
    const top6 = sortedCats.slice(0, 6)
    const otherTotal = sortedCats.slice(6).reduce((s, [, v]) => s + v, 0)
    const categoryBreakdown = [
      ...top6.map(([name, amount], i) => ({ name, amount, color: CATEGORY_COLORS[i] })),
      ...(otherTotal > 0 ? [{ name: 'Other', amount: otherTotal, color: CATEGORY_COLORS[6] }] : []),
    ]

    // ── 12-month comparison data for chart ───────────────────────────────────────
    const prevTransactions = prevTransactionsRes.data ?? []
    const prevIncome = prevTransactions
      .filter((t) => t.cr_dr === 'credit' && !t.is_internal_transfer)
      .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)
    const prevExpenses = prevTransactions
      .filter((t) => t.cr_dr === 'debit' && !t.is_internal_transfer)
      .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)

    // Build a month-keyed map from the single 12-month query
    const monthMap: Record<string, { income: number; expenses: number }> = {}
    for (const t of twelveMonthTxnsRes.data ?? []) {
      const key = (t.date as string).substring(0, 7) // "YYYY-MM"
      if (!monthMap[key]) monthMap[key] = { income: 0, expenses: 0 }
      if (t.cr_dr === 'credit') monthMap[key].income += Math.abs(t.amount_usd ?? 0)
      else monthMap[key].expenses += Math.abs(t.amount_usd ?? 0)
    }

    // Always return 12 months in chronological order, filling zeros for empty months
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        month: key,
        label,
        income: Math.round((monthMap[key]?.income ?? 0) * 100) / 100,
        expenses: Math.round((monthMap[key]?.expenses ?? 0) * 100) / 100,
      }
    })

    // ── Daily Insight — generate one per day if none exists yet ─────────────
    const hasInsightToday = latest_insight && latest_insight.created_at.startsWith(todayStr)

    if (!hasInsightToday && aiEnabled && process.env.ANTHROPIC_API_KEY) {
      try {
        const savingsRate = monthly_income > 0 ? ((monthly_income - monthly_expenses) / monthly_income * 100).toFixed(1) : '0'

        const dailyPromptTemplate = await getUserPrompt(
          supabase,
          user.id,
          'daily_insight',
          DEFAULT_PROMPTS.daily_insight.content,
        )

        const calendarContext =
          upcomingCalendarEvents.length > 0
            ? '\nUpcoming financial calendar events: ' +
              upcomingCalendarEvents
                .map((e) => {
                  const costPart = e.estimated_cost ? ` - $${e.estimated_cost}` : ''
                  return `${e.title} on ${e.start_date}${costPart}`
                })
                .join('; ')
            : ''

        const prompt = (dailyPromptTemplate + calendarContext)
          .replaceAll('{{net_worth}}', net_worth.toFixed(2))
          .replaceAll('{{monthly_income}}', monthly_income.toFixed(2))
          .replaceAll('{{monthly_expenses}}', monthly_expenses.toFixed(2))
          .replaceAll('{{savings_rate}}', savingsRate)
          .replaceAll('{{flagged_count}}', String(flagged_count))
          .replaceAll('{{bills_count}}', String(bills.length))

        const message = await anthropic.messages.create({
          model: aiModel,
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }],
        })

        const insightText = message.content[0].type === 'text' ? message.content[0].text : null
        if (insightText) {
          const { data: newInsight } = await supabase.from('ai_insights').insert({
            user_id: user.id,
            type: 'daily',
            content: insightText,
            month: todayStr,
            is_read: false,
          }).select().single()

          if (newInsight) {
            latest_insight = newInsight
          }
        }
      } catch (insightErr) {
        // Non-fatal — dashboard still loads without it
        console.warn('Daily insight generation failed:', insightErr)
      }
    }

    // ── Monthly Summary — generate once on first load of a new month ─────────
    if (aiEnabled && process.env.ANTHROPIC_API_KEY) {
      try {
        const { data: monthlySummary } = await supabase
          .from('ai_insights')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'monthly')
          .eq('month', firstDay)
          .limit(1)

        if (!monthlySummary || monthlySummary.length === 0) {
          if (prevTransactions && prevTransactions.length > 0) {
            const prevSavingsRate = prevIncome > 0 ? ((prevIncome - prevExpenses) / prevIncome * 100).toFixed(1) : '0'
            const topCats = 'See transactions page for breakdown'

            const monthlyPromptTemplate = await getUserPrompt(
              supabase,
              user.id,
              'monthly_summary',
              DEFAULT_PROMPTS.monthly_summary.content,
            )

            const summaryPrompt = monthlyPromptTemplate
              .replaceAll('{{month_label}}', prevMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
              .replaceAll('{{prev_income}}', prevIncome.toFixed(2))
              .replaceAll('{{prev_expenses}}', prevExpenses.toFixed(2))
              .replaceAll('{{prev_savings_rate}}', prevSavingsRate)
              .replaceAll('{{top_categories}}', topCats || 'none')

            const summaryMsg = await anthropic.messages.create({
              model: aiModel,
              max_tokens: 200,
              messages: [{ role: 'user', content: summaryPrompt }],
            })

            const summaryText = summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : null
            if (summaryText) {
              await supabase.from('ai_insights').insert({
                user_id: user.id,
                type: 'monthly',
                content: summaryText,
                month: firstDay,
                is_read: false,
              })
            }
          }
        }
      } catch (summaryErr) {
        console.warn('Monthly summary generation failed:', summaryErr)
      }
    }

    // Upsert this month's net worth snapshot using end-of-month date to match historical snapshots
    const currentMonthStr = lastDay
    await supabase.from('networth_snapshots').upsert(
      {
        user_id: user.id,
        month: currentMonthStr,
        assets_total: total_assets,
        liabilities_total: total_liabilities,
        net_worth,
      },
      { onConflict: 'user_id,month' }
    )

    return NextResponse.json({
      net_worth,
      total_assets,
      total_liabilities,
      monthly_income,
      monthly_expenses,
      savings_rate,
      flagged_count,
      upcoming_bills,
      networth_trend: [...snapshots].reverse(),
      latest_insight,
      categoryBreakdown,
      monthlyData,
    })
  } catch (err) {
    console.error('Dashboard error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
