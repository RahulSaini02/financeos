// Shared helper — deactivates the current active version for a prompt key and
// inserts a new active version. Used by POST /api/prompts/[key] and the reset route.

import { createServerSupabaseClient } from '@/lib/supabase-server'

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export async function savePromptVersion(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  content: string,
  versionLabel?: string | null,
  model?: string | null,
) {
  // Deactivate the current active version (if any)
  const { error: deactivateErr } = await supabase
    .from('user_prompts')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('prompt_key', key)
    .eq('is_active', true)

  if (deactivateErr) throw new Error(`Failed to deactivate current version: ${deactivateErr.message}`)

  // Determine next version number
  const { data: maxRow } = await supabase
    .from('user_prompts')
    .select('version')
    .eq('user_id', userId)
    .eq('prompt_key', key)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (maxRow?.version ?? 0) + 1

  // Insert new active version
  const { data: inserted, error: insertErr } = await supabase
    .from('user_prompts')
    .insert({
      user_id: userId,
      prompt_key: key,
      content: content.trim(),
      version: nextVersion,
      is_active: true,
      version_label: versionLabel ?? null,
      model: model ?? 'claude-haiku-4-5-20251001',
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    throw new Error(`Failed to insert new version: ${insertErr?.message ?? 'unknown'}`)
  }

  return inserted
}
