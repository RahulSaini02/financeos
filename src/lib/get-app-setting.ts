// Reads a single app_setting value by key.
// Works with any Supabase client (user or service role).
// Falls back to defaultValue if the row doesn't exist or the query fails.

import { createServerSupabaseClient } from '@/lib/supabase-server'

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export async function getAppSetting(
  supabase: SupabaseClient,
  key: string,
  defaultValue: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    return data?.value ?? defaultValue
  } catch {
    return defaultValue
  }
}
