// Server-only — the import below makes the build fail if this ever lands in a
// client bundle (it references the service-role key).
// Provides exchange-rate caching via the exchange_rates table and live
// fallback via the Frankfurter ECB feed (no API key required).

import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { CurrencyCode } from '@/lib/types'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Returns the exchange rate to convert 1 unit of `from` into `to`.
 *
 * Cache: queries exchange_rates for a row fetched within the last 24 h.
 * Accepts the inverse pair and returns 1/rate if that's what's cached.
 * On cache miss: fetches https://api.frankfurter.dev/v1/latest and persists
 * the result.
 * On any failure: falls back to the most recent stale row regardless of age.
 * If no row exists at all: returns null (callers must degrade gracefully).
 * Never throws.
 */
export async function getFxRate(from: CurrencyCode, to: CurrencyCode): Promise<number | null> {
  if (from === to) return 1

  const supabase = getServiceClient()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    // Check cache: match either direct (from→to) or inverse (to→from) pair
    const { data: cachedRows } = await supabase
      .from('exchange_rates')
      .select('rate, from_currency, to_currency')
      .or(
        `and(from_currency.eq.${from},to_currency.eq.${to}),and(from_currency.eq.${to},to_currency.eq.${from})`,
      )
      .gte('fetched_at', oneDayAgo)
      .order('fetched_at', { ascending: false })
      .limit(2)

    const cached = (cachedRows ?? []).find(
      (r) =>
        (r.from_currency === from && r.to_currency === to) ||
        (r.from_currency === to && r.to_currency === from),
    )
    if (cached) {
      return cached.from_currency === from ? cached.rate : 1 / cached.rate
    }

    // Cache miss — fetch live rate from Frankfurter (ECB data, free, no key)
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`,
      { next: { revalidate: 0 } },
    )
    if (!res.ok) throw new Error(`Frankfurter API returned ${res.status}`)
    const json = (await res.json()) as { rates: Record<string, number> }
    const rate = json.rates[to]
    if (typeof rate !== 'number') throw new Error(`Rate for ${to} not in Frankfurter response`)

    // Persist to cache (service role bypasses the READ-only RLS policy on exchange_rates)
    await supabase.from('exchange_rates').insert({
      from_currency: from,
      to_currency: to,
      rate,
      fetched_at: new Date().toISOString(),
    })

    return rate
  } catch (err) {
    console.error('[fx] getFxRate error:', err)

    // Stale fallback: most recent row for the pair regardless of age
    try {
      const { data: staleRows } = await supabase
        .from('exchange_rates')
        .select('rate, from_currency, to_currency')
        .or(
          `and(from_currency.eq.${from},to_currency.eq.${to}),and(from_currency.eq.${to},to_currency.eq.${from})`,
        )
        .order('fetched_at', { ascending: false })
        .limit(2)

      const stale = (staleRows ?? []).find(
        (r) =>
          (r.from_currency === from && r.to_currency === to) ||
          (r.from_currency === to && r.to_currency === from),
      )
      if (stale) {
        return stale.from_currency === from ? stale.rate : 1 / stale.rate
      }
    } catch { /* ignore */ }

    return null
  }
}

/**
 * Converts an amount using the given rate.
 * If rate is null (no cached or live rate available) the raw amount is returned
 * unchanged — this preserves current single-currency behavior and never blocks
 * an insert.
 */
export function convertAmount(amount: number, rate: number | null): number {
  return rate == null ? amount : amount * rate
}
