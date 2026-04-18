// GET  /api/prompts/[key]  — get active prompt + version history
// POST /api/prompts/[key]  — save new version (deactivates current active)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'

type Params = { params: Promise<{ key: string }> }

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
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

    // Active version
    const { data: activeRow } = await supabase
      .from('user_prompts')
      .select('content, version')
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .eq('is_active', true)
      .maybeSingle()

    // All versions (history), most recent first
    const { data: allVersions } = await supabase
      .from('user_prompts')
      .select('id, version, version_label, created_at')
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .order('version', { ascending: false })

    return NextResponse.json({
      key,
      content: activeRow ? activeRow.content : DEFAULT_PROMPTS[key].content,
      version: activeRow ? activeRow.version : 0,
      isDefault: !activeRow,
      versions: allVersions ?? [],
    })
  } catch (err) {
    console.error('GET /api/prompts/[key] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
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

    const body = await req.json()
    const { content, version_label } = body as { content?: string; version_label?: string }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // Deactivate the current active version
    const { error: deactivateErr } = await supabase
      .from('user_prompts')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .eq('is_active', true)

    if (deactivateErr) {
      console.error('prompt deactivate error:', deactivateErr)
      return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 })
    }

    // Get max version for this key
    const { data: maxRow } = await supabase
      .from('user_prompts')
      .select('version')
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (maxRow?.version ?? 0) + 1

    // Insert new active version
    const { data: inserted, error: insertErr } = await supabase
      .from('user_prompts')
      .insert({
        user_id: user.id,
        prompt_key: key,
        content: content.trim(),
        version: nextVersion,
        is_active: true,
        version_label: version_label ?? null,
      })
      .select()
      .single()

    if (insertErr || !inserted) {
      console.error('prompt insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to save prompt' }, { status: 500 })
    }

    return NextResponse.json(
      {
        id: inserted.id,
        key: inserted.prompt_key,
        content: inserted.content,
        version: inserted.version,
        created_at: inserted.created_at,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('POST /api/prompts/[key] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
