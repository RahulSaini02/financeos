import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { inferSubscriptionCategory } from '@/lib/subscription-categorize'

/**
 * POST /api/subscriptions/categorize
 * Body: { subscription_id: string }
 *
 * AI-categorizes a single uncategorized subscription (streaming, utilities,
 * insurance, SaaS, …) and persists the result to subscriptions.category_id so
 * it never re-runs. Already-categorized subscriptions are returned as-is —
 * a manual choice is never overwritten.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let subscriptionId: string
  try {
    const body = await request.json()
    subscriptionId = body.subscription_id
    if (!subscriptionId || typeof subscriptionId !== 'string') throw new Error('Missing subscription_id')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, name, category_id')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  if (sub.category_id) {
    return NextResponse.json({ category_id: sub.category_id, inferred: false })
  }

  const categoryId = await inferSubscriptionCategory(supabase, user.id, sub.name)
  if (categoryId) {
    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({ category_id: categoryId })
      .eq('id', sub.id)
      .eq('user_id', user.id)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ category_id: categoryId, inferred: categoryId !== null })
}
