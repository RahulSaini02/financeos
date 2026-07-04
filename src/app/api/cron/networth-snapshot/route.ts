import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFxRate, convertAmount } from '@/lib/fx'

// Called by Vercel Cron on the last day of each month.
// Also callable manually: GET /api/cron/networth-snapshot
// Requires header: Authorization: Bearer <CRON_SECRET>

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service-role / secret key so we can read all users' accounts without RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Fetch all active accounts grouped by user (include currency for FX conversion)
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('user_id, kind, current_balance, currency')
    .eq('is_active', true)

  if (error) {
    console.error('networth-snapshot cron: fetch accounts error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch all profiles to get each user's base currency
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, default_currency')

  const profileCurrency: Record<string, string> = {}
  for (const p of profiles ?? []) {
    profileCurrency[p.id] = p.default_currency
  }

  // Pre-fetch USD↔INR rate once (covers all cross-currency pairs with our 2-currency enum)
  const inrToUsdRate = await getFxRate('INR', 'USD')

  function toUserBase(amount: number, accountCurrency: string, baseCurrency: string): number {
    if (accountCurrency === baseCurrency) return amount
    if (accountCurrency === 'INR' && baseCurrency === 'USD') {
      return convertAmount(amount, inrToUsdRate)
    }
    if (accountCurrency === 'USD' && baseCurrency === 'INR') {
      return convertAmount(amount, inrToUsdRate != null ? 1 / inrToUsdRate : null)
    }
    return amount
  }

  // Aggregate per user, converting each account to the user's base currency
  const byUser: Record<string, { assets: number; liabilities: number }> = {}
  for (const account of accounts ?? []) {
    if (!byUser[account.user_id]) {
      byUser[account.user_id] = { assets: 0, liabilities: 0 }
    }
    const baseCurrency = profileCurrency[account.user_id] ?? 'USD'
    const bal = toUserBase(account.current_balance ?? 0, account.currency ?? 'USD', baseCurrency)
    if (account.kind === 'liability') {
      byUser[account.user_id].liabilities += Math.abs(bal)
    } else {
      // asset + investment both count as assets
      byUser[account.user_id].assets += bal
    }
  }

  const upserts = Object.entries(byUser).map(([user_id, { assets, liabilities }]) => ({
    user_id,
    month: monthStr,
    assets_total: assets,
    liabilities_total: liabilities,
    net_worth: assets - liabilities,
  }))

  if (upserts.length === 0) {
    return NextResponse.json({ ok: true, users: 0, month: monthStr })
  }

  const { error: upsertError } = await supabase
    .from('networth_snapshots')
    .upsert(upserts, { onConflict: 'user_id,month' })

  if (upsertError) {
    console.error('networth-snapshot cron: upsert error', upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  console.log(`networth-snapshot: saved ${upserts.length} snapshots for ${monthStr}`)
  return NextResponse.json({ ok: true, users: upserts.length, month: monthStr })
}
