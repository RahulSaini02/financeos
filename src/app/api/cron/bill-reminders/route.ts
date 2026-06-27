/**
 * GET /api/cron/bill-reminders
 * Runs at 7am PT (15:00 UTC). Finds all active subscriptions due tomorrow,
 * groups by user, and sends one push notification per bill.
 * Cleans up stale (410/404) push subscriptions.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  or  x-cron-secret header
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendPushNotification } from '@/lib/push-notifications'

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

  const supabase = createServiceClient()

  // Calculate tomorrow's date in UTC
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Fetch all active subscriptions due tomorrow
  const { data: dueSubs, error: subsErr } = await supabase
    .from('subscriptions')
    .select('id, user_id, name, billing_cost, next_billing_date')
    .eq('status', 'active')
    .eq('next_billing_date', tomorrowStr)

  if (subsErr) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }

  if (!dueSubs || dueSubs.length === 0) {
    return NextResponse.json({ notified: 0, message: 'No bills due tomorrow' })
  }

  // Group bills by user_id
  type DueSub = { id: string; user_id: string; name: string; billing_cost: number; next_billing_date: string }
  const byUser = new Map<string, DueSub[]>()
  for (const sub of dueSubs) {
    const s = sub as DueSub
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, [])
    byUser.get(s.user_id)!.push(s)
  }

  let totalNotified = 0

  for (const [userId, bills] of byUser) {
    try {
      // Fetch push subscriptions for this user
      const { data: pushSubs } = await supabase
        .from('user_push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', userId)

      if (!pushSubs || pushSubs.length === 0) continue

      type PushSub = { id: string; endpoint: string; p256dh: string; auth: string }

      for (const bill of bills) {
        const costStr = bill.billing_cost != null ? `$${Number(bill.billing_cost).toFixed(2)}` : ''
        const body = costStr ? `${bill.name} — ${costStr}` : bill.name
        const staleIds: string[] = []

        for (const push of pushSubs) {
          const p = push as PushSub
          try {
            const result = await sendPushNotification(
              { endpoint: p.endpoint, p256dh: p.p256dh, auth: p.auth },
              {
                title: '📅 Bill Due Tomorrow',
                body,
                url: '/subscriptions',
                tag: `bill-reminder-${bill.id}`,
              }
            )
            if (result.gone) staleIds.push(p.id)
            else totalNotified++
          } catch {
            // Non-fatal per subscription
          }
        }

        // Remove stale push subscriptions
        if (staleIds.length > 0) {
          await supabase
            .from('user_push_subscriptions')
            .delete()
            .in('id', staleIds)
        }
      }
    } catch (err) {
      console.error(`bill-reminders cron error for user ${userId}:`, err)
    }
  }

  return NextResponse.json({ date: tomorrowStr, billsFound: dueSubs.length, notified: totalNotified })
}
