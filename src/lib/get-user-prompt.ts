// src/lib/get-user-prompt.ts
// Shared helper — fetches the user's active custom prompt for a given key,
// falling back to the supplied default content if no override exists.

import { createServerSupabaseClient } from '@/lib/supabase-server'

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export async function getUserPrompt(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  defaultContent: string,
): Promise<string> {
  const { data } = await supabase
    .from('user_prompts')
    .select('content')
    .eq('user_id', userId)
    .eq('prompt_key', key)
    .eq('is_active', true)
    .maybeSingle()

  return data?.content ?? defaultContent
}
