import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendPushNotification } from '@/lib/push-notifications'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: pushSubs } = await supabase
    .from('user_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!pushSubs || pushSubs.length === 0) {
    return NextResponse.json({ error: 'No push subscription found for your account' }, { status: 404 })
  }

  type PushSub = { id: string; endpoint: string; p256dh: string; auth: string }
  const staleIds: string[] = []
  let sent = 0

  for (const sub of pushSubs) {
    const p = sub as PushSub
    try {
      const result = await sendPushNotification(
        { endpoint: p.endpoint, p256dh: p.p256dh, auth: p.auth },
        {
          title: 'FinanceOS Notifications',
          body: 'Push notifications are working!',
          url: '/settings',
          tag: 'test-notification',
        }
      )
      if (result.gone) staleIds.push(p.id)
      else sent++
    } catch (err) {
      console.error('Test push error:', err)
    }
  }

  if (staleIds.length > 0) {
    await supabase.from('user_push_subscriptions').delete().in('id', staleIds)
  }

  if (sent === 0) {
    return NextResponse.json({ error: 'Subscription is stale — please re-enable notifications' }, { status: 410 })
  }

  return NextResponse.json({ ok: true, sent })
}
