import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Per-user limits — adjust here to tighten/loosen globally
const DAILY_LIMIT = 20    // max interactive AI calls per calendar day
const MINUTE_LIMIT = 5    // max calls in any rolling 60-second window

export type AiEndpoint = 'chat' | 'review' | 'agent'

interface RateLimitResult {
  allowed: true
  dailyUsed: number
  dailyRemaining: number
}

interface RateLimitDenied {
  allowed: false
  response: NextResponse
}

/**
 * Checks both the per-minute and daily caps for the given user.
 * If allowed, logs the call and returns usage counts.
 * If denied, returns a 429 NextResponse ready to be returned from the API route.
 *
 * Uses the Supabase service-role client (passed in) so writes bypass RLS.
 */
export async function checkAndLogAiUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  endpoint: AiEndpoint,
): Promise<RateLimitResult | RateLimitDenied> {
  const now = new Date()
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString()

  // Midnight of today in UTC — counts resets each UTC calendar day
  const todayMidnight = new Date(now)
  todayMidnight.setUTCHours(0, 0, 0, 0)
  const todayStr = todayMidnight.toISOString()

  // Run both count queries in parallel
  const [minuteResult, dailyResult] = await Promise.all([
    supabase
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneMinuteAgo),
    supabase
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStr),
  ])

  const minuteCount = minuteResult.count ?? 0
  const dailyCount = dailyResult.count ?? 0

  if (minuteCount >= MINUTE_LIMIT) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Too many requests. Please wait a moment before trying again.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: 60,
        },
        {
          status: 429,
          headers: { 'Retry-After': '60' },
        },
      ),
    }
  }

  if (dailyCount >= DAILY_LIMIT) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `You've reached your daily AI limit of ${DAILY_LIMIT} messages. Your quota resets at midnight UTC.`,
          code: 'DAILY_LIMIT_REACHED',
          dailyLimit: DAILY_LIMIT,
          resetsAt: new Date(todayMidnight.getTime() + 86_400_000).toISOString(),
        },
        { status: 429 },
      ),
    }
  }

  // Log the usage (fire-and-forget — don't block the response on write errors)
  supabase
    .from('ai_usage_log')
    .insert({ user_id: userId, endpoint })
    .then(({ error }) => {
      if (error) console.error('[ai-rate-limit] usage log insert error:', error)
    })

  return {
    allowed: true,
    dailyUsed: dailyCount + 1,
    dailyRemaining: DAILY_LIMIT - dailyCount - 1,
  }
}

export { DAILY_LIMIT, MINUTE_LIMIT }
