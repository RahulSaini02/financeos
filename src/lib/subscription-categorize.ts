import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Infers the best category for a Bills & Subscriptions charge (streaming,
 * utilities, insurance, SaaS, …) from the merchant/subscription name using
 * the low-cost auto-categorization model.
 *
 * Best-effort: returns null on any failure so callers can fall back.
 * Currency/region agnostic — only the merchant name is considered.
 * Works with both user-scoped and service-role Supabase clients (cron).
 */
export async function inferSubscriptionCategory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  merchantName: string,
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const name = merchantName?.trim()
  if (!name || name.length < 2) return null

  try {
    const [{ data: cats }, { data: modelRow }] = await Promise.all([
      supabase.from('categories').select('id, name, type').eq('user_id', userId).order('name'),
      supabase.from('app_settings').select('value').eq('key', 'ai_model_auto_categorize').maybeSingle(),
    ])
    if (!cats || cats.length === 0) return null

    const model = modelRow?.value ?? 'claude-haiku-4-5-20251001'
    const catList = (cats as { id: string; name: string; type: string }[])
      .map((c) => `${c.id} | ${c.name} (${c.type})`)
      .join('\n')

    const prompt = `You categorize recurring bills and subscriptions for a personal finance app.
Given a merchant/subscription name, pick the single best matching category from the user's list — think in terms of what the service is (streaming, utilities, insurance, software/SaaS, phone, gym, rent, etc.).

Merchant/subscription name: "${name}"

User's categories (id | name (type)):
${catList}

Reply with ONLY the category id from the list, or "none" if nothing fits well. No other text.`

    // NOTE: this Anthropic call is deliberately NOT tracked by ai-rate-limit —
    // it only runs from server-initiated paths (autopay cron, one-shot backfill).
    // If this helper is ever exposed to a user-triggered path, wrap the caller
    // in checkAndLogAiUsage/recordAiUsageCost first.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    })

    const reply = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : 'none'
    const suggestedId = reply.split(/[|\s]/)[0]?.trim()
    return (cats as { id: string }[]).some((c) => c.id === suggestedId) ? suggestedId : null
  } catch (err) {
    console.error('[subscription-categorize] inference failed:', err)
    return null
  }
}
