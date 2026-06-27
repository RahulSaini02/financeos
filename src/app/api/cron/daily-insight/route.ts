/**
 * GET /api/cron/daily-insight
 * Runs at 6am PT (14:00 UTC). For every user who has push subscriptions AND
 * ai_enabled=true:
 *   1. Check if a 'daily' insight already exists for today
 *   2. If not — fetch financial snapshot, generate insight via Anthropic, save
 *   3. Send push notification with first ~100 chars of the insight
 *   4. Clean up stale (410/404) subscriptions
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

// Build a service-role Supabase client (no cookie context needed for crons)
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
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
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0]

  // Fetch all users who have at least one push subscription
  const { data: subscriptionRows, error: subsErr } = await supabase
    .from('user_push_subscriptions')
    .select('user_id, id, endpoint, p256dh, auth')

  if (subsErr) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }

  // Group subscriptions by user_id
  type SubRow = { user_id: string; id: string; endpoint: string; p256dh: string; auth: string }
  const byUser = new Map<string, SubRow[]>()
  for (const row of subscriptionRows ?? []) {
    const r = row as SubRow
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, [])
    byUser.get(r.user_id)!.push(r)
  }

  const aiModel = await getAppSetting(supabase, 'ai_model_daily_insight', 'claude-haiku-4-5-20251001')

  const results: { userId: string; status: string }[] = []

  for (const [userId, userSubs] of byUser) {
    try {
      // Check ai_enabled for this user
      const { data: profile } = await supabase
        .from('profiles')
        .select('ai_enabled')
        .eq('id', userId)
        .maybeSingle()
      if (!profile?.ai_enabled) continue

      // Check if daily insight already exists for today
      const { data: existingInsight } = await supabase
        .from('ai_insights')
        .select('id, content')
        .eq('user_id', userId)
        .eq('type', 'daily')
        .gte('created_at', `${todayStr}T00:00:00.000Z`)
        .limit(1)

      let insightContent: string | null = existingInsight?.[0]?.content ?? null

      // Generate insight if none exists today
      if (!insightContent) {
        // Fetch financial snapshot
        const [accountsRes, transactionsRes, flaggedRes, billsRes] = await Promise.all([
          supabase
            .from('accounts')
            .select('kind, current_balance')
            .eq('user_id', userId)
            .eq('is_active', true),
          supabase
            .from('transactions')
            .select('amount_usd, cr_dr, is_internal_transfer')
            .eq('user_id', userId)
            .gte('date', thirtyDaysAgoStr)
            .lte('date', todayStr),
          supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('flagged', true),
          supabase
            .from('subscriptions')
            .select('name, next_billing_date, billing_cost')
            .eq('user_id', userId)
            .eq('status', 'active')
            .not('next_billing_date', 'is', null)
            .gte('next_billing_date', todayStr)
            .lte('next_billing_date', sevenDaysStr),
        ])

        const accounts = accountsRes.data ?? []
        const transactions = transactionsRes.data ?? []
        const flagged_count = flaggedRes.count ?? 0
        const bills = billsRes.data ?? []

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

        const dailyPromptTemplate = await getUserPrompt(
          supabase,
          userId,
          'daily_insight',
          DEFAULT_PROMPTS.daily_insight.content
        )

        const prompt = dailyPromptTemplate
          .replaceAll('{{net_worth}}', net_worth.toFixed(2))
          .replaceAll('{{monthly_income}}', monthly_income.toFixed(2))
          .replaceAll('{{monthly_expenses}}', monthly_expenses.toFixed(2))
          .replaceAll('{{savings_rate}}', savings_rate.toFixed(1))
          .replaceAll('{{flagged_count}}', String(flagged_count))
          .replaceAll('{{bills_count}}', String(bills.length))

        const message = await anthropic.messages.create({
          model: aiModel,
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }],
        })

        const insightText =
          message.content[0].type === 'text' ? message.content[0].text : null

        if (insightText) {
          await supabase.from('ai_insights').insert({
            user_id: userId,
            type: 'daily',
            content: insightText,
            month: firstDay,
            is_read: false,
          })
          insightContent = insightText
        }
      }

      // Send push notification if we have insight content
      if (insightContent) {
        const pushBody = insightContent.slice(0, 100) + (insightContent.length > 100 ? '…' : '')
        const staleIds: string[] = []

        for (const sub of userSubs) {
          try {
            const result = await sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              {
                title: 'Your Daily Financial Insight',
                body: pushBody,
                url: '/dashboard',
                tag: `daily-insight-${todayStr}`,
              }
            )
            if (result.gone) staleIds.push(sub.id)
          } catch {
            // Non-fatal — continue with remaining subscriptions
          }
        }

        // Clean up stale subscriptions
        if (staleIds.length > 0) {
          await supabase
            .from('user_push_subscriptions')
            .delete()
            .in('id', staleIds)
        }
      }

      results.push({ userId, status: 'ok' })
    } catch (err) {
      console.error(`daily-insight cron error for user ${userId}:`, err)
      results.push({ userId, status: 'error' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
