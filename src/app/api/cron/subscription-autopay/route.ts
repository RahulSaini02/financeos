import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inferSubscriptionCategory } from '@/lib/subscription-categorize'
import { getFxRate, convertAmount } from '@/lib/fx'

/**
 * GET /api/cron/subscription-autopay
 * Runs daily. For every active subscription with auto_renew=true and an
 * account_id whose next_billing_date is today, this job:
 *   1. Creates a debit transaction on the linked account
 *   2. Reduces the account balance
 *   3. Advances next_billing_date by billing_cycle_months
 *
 * Authorize with: Authorization: Bearer <CRON_SECRET>
 * or header: x-cron-secret: <CRON_SECRET>
 */
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

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const today = new Date().toISOString().split('T')[0]

    // Find active auto-renew subscriptions due today that have an account linked
    const { data: subs, error: subsErr } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .eq('auto_renew', true)
      .not('account_id', 'is', null)
      .eq('next_billing_date', today)

    if (subsErr) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    // Batch-fetch account currencies for all linked accounts
    const subAccountIds = [
      ...new Set((subs ?? []).map((s) => s.account_id).filter(Boolean) as string[]),
    ]
    const accountCurrencyMap: Record<string, string> = {}
    if (subAccountIds.length > 0) {
      const { data: accts } = await supabase
        .from('accounts')
        .select('id, currency')
        .in('id', subAccountIds)
      for (const a of accts ?? []) {
        accountCurrencyMap[a.id] = a.currency ?? 'USD'
      }
    }

    // Pre-fetch INR→USD rate once
    const inrToUsdRate = await getFxRate('INR', 'USD')

    const results: { subId: string; name: string; created: boolean; error?: string }[] = []

    for (const sub of subs ?? []) {
      // Idempotency: check if we already created a transaction for this sub today
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', sub.user_id)
        .eq('account_id', sub.account_id)
        .ilike('description', `%${sub.name}%`)
        .eq('date', today)
        .eq('source', 'manual')
        .limit(1)

      if (existing && existing.length > 0) {
        results.push({ subId: sub.id, name: sub.name, created: false })
        continue
      }

      // Category priority: (1) the subscription's own category, (2) AI
      // inference from the merchant name — persisted onto the subscription
      // so it never re-runs, (3) generic "Subscriptions" fallback
      let categoryId: string | null = sub.category_id ?? null
      let aiCategorized = false
      if (!categoryId) {
        categoryId = await inferSubscriptionCategory(supabase, sub.user_id, sub.name)
        if (categoryId) {
          aiCategorized = true
          await supabase
            .from('subscriptions')
            .update({ category_id: categoryId })
            .eq('id', sub.id)
            .eq('user_id', sub.user_id)
        }
      }
      if (!categoryId) {
        const { data: existingCat } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', sub.user_id)
          .eq('name', 'Subscriptions')
          .single()
        if (existingCat) {
          categoryId = existingCat.id
        } else {
          const { data: newCat } = await supabase
            .from('categories')
            .insert({ user_id: sub.user_id, name: 'Subscriptions' })
            .select('id')
            .single()
          if (newCat) categoryId = newCat.id
        }
      }

      const subCurrency = accountCurrencyMap[sub.account_id] ?? 'USD'
      const usdNormalized = subCurrency !== 'USD'
        ? convertAmount(sub.billing_cost, inrToUsdRate)
        : sub.billing_cost
      const signedAmt = -Math.abs(sub.billing_cost) // native signed (for balance update)

      // Create debit transaction (amount_usd stores USD-normalized value)
      const { error: txnErr } = await supabase.from('transactions').insert({
        user_id: sub.user_id,
        account_id: sub.account_id,
        category_id: categoryId,
        description: sub.name,
        amount_usd: -usdNormalized,
        final_amount: -usdNormalized,
        amount_original: sub.billing_cost,
        original_currency: subCurrency,
        cr_dr: 'debit',
        date: today,
        source: 'manual',
        import_status: 'confirmed',
        flagged: false,
        is_recurring: true,
        ai_categorized: aiCategorized,
        is_internal_transfer: false,
        notes: `Auto-charged — ${sub.billing_cycle_months === 1 ? 'Monthly' : `Every ${sub.billing_cycle_months} months`}`,
      })

      if (txnErr) {
        results.push({ subId: sub.id, name: sub.name, created: false, error: txnErr.message })
        continue
      }

      // Deduct from account balance atomically
      await supabase.rpc('increment_account_balance', { p_account_id: sub.account_id, p_delta: signedAmt })

      // Advance next_billing_date
      const nextDate = new Date(today + 'T00:00:00')
      nextDate.setMonth(nextDate.getMonth() + sub.billing_cycle_months)
      const nextBillingDate = nextDate.toISOString().split('T')[0]

      await supabase
        .from('subscriptions')
        .update({ next_billing_date: nextBillingDate })
        .eq('id', sub.id)

      results.push({ subId: sub.id, name: sub.name, created: true })
    }

    const created = results.filter((r) => r.created).length
    return NextResponse.json({ processed: results.length, created, results })
  } catch (err) {
    console.error('Subscription autopay error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
