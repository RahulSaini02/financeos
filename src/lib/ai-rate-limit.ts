import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Defaults — the live values are admin-editable in app_settings and applied
// without redeploy. These are only fallbacks if the settings rows are missing.
const DEFAULT_MINUTE_LIMIT = 15      // requests in any rolling 60-second window
const DEFAULT_DAILY_COST_CAP = 0.75  // USD per user per UTC calendar day

export const SOFT_WARNING_RATIO = 0.8 // warn the user at 80% of the daily cap

export type AiEndpoint = 'chat' | 'review' | 'agent'

// $ per million tokens. Cache reads bill at 0.1× input, cache writes at 1.25×.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-opus-4-6': { input: 5, output: 25 },
}
const FALLBACK_PRICING = MODEL_PRICING['claude-sonnet-4-6']

export interface TurnTokenUsage {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
}

export function estimateCostUsd(model: string, usage: TurnTokenUsage): number {
  const pricing = MODEL_PRICING[model] ?? FALLBACK_PRICING
  const perTok = 1 / 1_000_000
  return (
    usage.inputTokens * pricing.input * perTok +
    usage.outputTokens * pricing.output * perTok +
    (usage.cacheCreationTokens ?? 0) * pricing.input * 1.25 * perTok +
    (usage.cacheReadTokens ?? 0) * pricing.input * 0.1 * perTok
  )
}

interface RateLimitResult {
  allowed: true
  usageLogId: string | null
  costUsedToday: number
  costCap: number
}

interface RateLimitDenied {
  allowed: false
  response: NextResponse
}

function utcMidnightToday(): Date {
  const midnight = new Date()
  midnight.setUTCHours(0, 0, 0, 0)
  return midnight
}

/**
 * Enforces both per-user AI limits:
 *  - Rate limit (abuse protection): N requests/min, sliding window — counts
 *    user-initiated turns only (tool calls inside a turn never hit this path).
 *  - Cost cap (budget protection): $X/day, UTC calendar-day reset — counts the
 *    full turn cost recorded by recordAiUsageCost (query + tools + reasoning).
 * Both limits are read from app_settings so admins can change them live.
 *
 * If allowed, logs the call and returns the usage row id so the caller can
 * attach final token counts via recordAiUsageCost after the turn completes.
 */
export async function checkAndLogAiUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  endpoint: AiEndpoint,
): Promise<RateLimitResult | RateLimitDenied> {
  const now = new Date()
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString()
  const todayMidnight = utcMidnightToday()
  const todayStr = todayMidnight.toISOString()

  const [settingsResult, minuteResult, dailyCostResult] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['ai_rate_limit_per_min', 'ai_daily_cost_cap_usd']),
    supabase
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneMinuteAgo),
    supabase
      .from('ai_usage_log')
      .select('cost_usd')
      .eq('user_id', userId)
      .gte('created_at', todayStr),
  ])

  const settings = new Map(
    (settingsResult.data ?? []).map((row: { key: string; value: string }) => [row.key, row.value]),
  )
  const parsedMinuteLimit = Number(settings.get('ai_rate_limit_per_min'))
  const minuteLimit =
    Number.isFinite(parsedMinuteLimit) && parsedMinuteLimit > 0 ? parsedMinuteLimit : DEFAULT_MINUTE_LIMIT
  const parsedCostCap = Number(settings.get('ai_daily_cost_cap_usd'))
  const costCap =
    Number.isFinite(parsedCostCap) && parsedCostCap > 0 ? parsedCostCap : DEFAULT_DAILY_COST_CAP

  const minuteCount = minuteResult.count ?? 0
  const costUsedToday = (dailyCostResult.data ?? []).reduce(
    (sum: number, row: { cost_usd: number | string | null }) => sum + Number(row.cost_usd ?? 0),
    0,
  )

  if (minuteCount >= minuteLimit) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Too many requests. Please wait a moment before trying again.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: 60,
        },
        { status: 429, headers: { 'Retry-After': '60' } },
      ),
    }
  }

  if (costUsedToday >= costCap) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `You've reached your daily AI budget of $${costCap.toFixed(2)}. AI features resume at midnight UTC — the rest of the app keeps working normally.`,
          code: 'DAILY_LIMIT_REACHED',
          costUsedToday: Number(costUsedToday.toFixed(4)),
          costCap,
          resetsAt: new Date(todayMidnight.getTime() + 86_400_000).toISOString(),
        },
        { status: 429 },
      ),
    }
  }

  // Log the turn now (cost 0); the route records final cost when the turn ends
  const { data: usageRow, error: insertError } = await supabase
    .from('ai_usage_log')
    .insert({ user_id: userId, endpoint })
    .select('id')
    .single()
  if (insertError) console.error('[ai-rate-limit] usage log insert error:', insertError)

  return {
    allowed: true,
    usageLogId: usageRow?.id ?? null,
    costUsedToday,
    costCap,
  }
}

/**
 * Attaches the final token counts + computed cost to a usage row after the
 * turn completes. Fire-and-forget from routes (never blocks the response).
 *
 * Uses the service-role client on purpose: there is no user-scoped UPDATE
 * policy on ai_usage_log, so users can't rewrite their own cost_usd from the
 * browser and bypass the daily cap.
 */
export async function recordAiUsageCost(
  usageLogId: string | null,
  model: string,
  usage: TurnTokenUsage,
): Promise<void> {
  if (!usageLogId) return
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      console.error('[ai-rate-limit] missing service-role env — cost not recorded')
      return
    }
    const admin = createClient(url, serviceKey)
    const { error } = await admin
      .from('ai_usage_log')
      .update({
        model,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cost_usd: estimateCostUsd(model, usage),
      })
      .eq('id', usageLogId)
    if (error) console.error('[ai-rate-limit] cost update error:', error)
  } catch (err) {
    console.error('[ai-rate-limit] cost update error:', err)
  }
}

/** Today's spend vs cap for the user-facing usage meter. */
export async function getDailyAiUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<{ costUsedToday: number; costCap: number }> {
  const todayStr = utcMidnightToday().toISOString()
  const [settingResult, costResult] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'ai_daily_cost_cap_usd').maybeSingle(),
    supabase.from('ai_usage_log').select('cost_usd').eq('user_id', userId).gte('created_at', todayStr),
  ])
  const parsedCap = Number(settingResult.data?.value)
  const costCap = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : DEFAULT_DAILY_COST_CAP
  const costUsedToday = (costResult.data ?? []).reduce(
    (sum: number, row: { cost_usd: number | string | null }) => sum + Number(row.cost_usd ?? 0),
    0,
  )
  return { costUsedToday, costCap }
}
