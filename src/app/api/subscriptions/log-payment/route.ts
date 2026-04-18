import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/subscriptions/log-payment
 * Body: { subscription_id: string }
 *
 * Manually logs a payment for a subscription:
 *   1. Creates a debit transaction (if account linked)
 *   2. Deducts from account balance
 *   3. Advances next_billing_date by billing_cycle_months
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let subscription_id: string
  try {
    const body = await request.json()
    subscription_id = body.subscription_id
    if (!subscription_id) throw new Error('Missing subscription_id')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Fetch the subscription (RLS ensures it belongs to this user)
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscription_id)
    .eq('user_id', user.id)
    .single()

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  const today = new Date().toISOString().split('T')[0]

  // If account is linked, check for existing transaction today to avoid double-logging
  if (sub.account_id) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('account_id', sub.account_id)
      .eq('date', today)
      .ilike('description', sub.name)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Payment already logged for today' }, { status: 409 })
    }
  }

  // Create transaction if account linked
  if (sub.account_id) {
    const signedAmt = -Math.abs(sub.billing_cost)

    // Find or create a "Subscriptions" category
    let categoryId: string | null = null
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', 'subscriptions')
      .limit(1)
      .maybeSingle()

    if (cat) {
      categoryId = cat.id
    } else {
      const { data: newCat } = await supabase
        .from('categories')
        .insert({ user_id: user.id, name: 'Subscriptions', color: '#6366f1', icon: 'repeat' })
        .select('id')
        .single()
      if (newCat) categoryId = newCat.id
    }

    const { error: txnErr } = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: sub.account_id,
      category_id: categoryId,
      description: sub.name,
      amount_usd: signedAmt,
      final_amount: signedAmt,
      amount_original: sub.billing_cost,
      original_currency: 'USD',
      cr_dr: 'debit',
      date: today,
      source: 'manual',
      import_status: 'confirmed',
      flagged: false,
      is_recurring: true,
      ai_categorized: false,
      is_internal_transfer: false,
      notes: `Manual payment — ${sub.billing_cycle_months === 1 ? 'Monthly' : `Every ${sub.billing_cycle_months} months`}`,
    })

    if (txnErr) {
      return NextResponse.json({ error: txnErr.message }, { status: 500 })
    }

    // Deduct from account balance
    const { data: acct } = await supabase
      .from('accounts')
      .select('current_balance')
      .eq('id', sub.account_id)
      .eq('user_id', user.id)
      .single()

    if (acct) {
      await supabase
        .from('accounts')
        .update({ current_balance: (acct.current_balance ?? 0) + signedAmt })
        .eq('id', sub.account_id)
        .eq('user_id', user.id)
    }
  }

  // Advance next_billing_date
  const nextDate = new Date(today + 'T00:00:00')
  nextDate.setMonth(nextDate.getMonth() + sub.billing_cycle_months)
  const nextBillingDate = nextDate.toISOString().split('T')[0]

  const { error: updateErr } = await supabase
    .from('subscriptions')
    .update({ next_billing_date: nextBillingDate })
    .eq('id', sub.id)
    .eq('user_id', user.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ next_billing_date: nextBillingDate })
}
