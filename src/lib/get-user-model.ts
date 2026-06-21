// Shared helper — fetches the user's preferred AI model, falling back to the
// app_settings default, then the hardcoded default Haiku model if neither is set.

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppSetting } from '@/lib/get-app-setting'

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export const DEFAULT_AI_MODEL = 'claude-haiku-4-5-20251001'

export const AI_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — Fast & cost-efficient (default)' },
  { value: 'claude-sonnet-4-6',         label: 'Sonnet 4.6 — Balanced (recommended)' },
  { value: 'claude-opus-4-6',           label: 'Opus 4.6 — Most capable' },
] as const

export type AIModelValue = typeof AI_MODELS[number]['value']

export async function getUserModel(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('user_prompts')
    .select('content')
    .eq('user_id', userId)
    .eq('prompt_key', 'ai_model')
    .eq('is_active', true)
    .maybeSingle()

  if (data?.content && data.content.trim().length > 0) {
    return data.content
  }

  // No user override — fall back to the admin-configured default from app_settings
  return getAppSetting(supabase, 'ai_model_chat_default', DEFAULT_AI_MODEL)
}
