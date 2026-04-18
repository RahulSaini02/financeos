// POST /api/prompts/[key]/reset
// Resets the prompt to its default content by saving a new version with
// the default text and version_label = 'Default reset'.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'

type Params = { params: Promise<{ key: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { key } = await params
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!DEFAULT_PROMPTS[key]) {
      return NextResponse.json({ error: 'Unknown prompt key' }, { status: 404 })
    }

    const defaultContent = DEFAULT_PROMPTS[key].content

    // Deactivate the current active version
    const { error: deactivateErr } = await supabase
      .from('user_prompts')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .eq('is_active', true)

    if (deactivateErr) {
      console.error('prompt reset deactivate error:', deactivateErr)
      return NextResponse.json({ error: 'Failed to reset prompt' }, { status: 500 })
    }

    // Get max version
    const { data: maxRow } = await supabase
      .from('user_prompts')
      .select('version')
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (maxRow?.version ?? 0) + 1

    // Insert new active version with default content
    const { data: inserted, error: insertErr } = await supabase
      .from('user_prompts')
      .insert({
        user_id: user.id,
        prompt_key: key,
        content: defaultContent,
        version: nextVersion,
        is_active: true,
        version_label: 'Default reset',
      })
      .select()
      .single()

    if (insertErr || !inserted) {
      console.error('prompt reset insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to reset prompt' }, { status: 500 })
    }

    return NextResponse.json({
      content: inserted.content,
      version: inserted.version,
    })
  } catch (err) {
    console.error('POST /api/prompts/[key]/reset error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
