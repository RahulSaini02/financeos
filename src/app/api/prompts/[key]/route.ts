// GET  /api/prompts/[key]  — get active prompt + version history (with content)
// POST /api/prompts/[key]  — save new version (deactivates current active)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'
import { savePromptVersion } from '@/lib/save-prompt-version'

const MAX_PROMPT_LENGTH = 10_000

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
      .select('content, version, model')
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .eq('is_active', true)
      .maybeSingle()

    // All versions (history), most recent first — include content so UI can restore old versions
    const { data: allVersions } = await supabase
      .from('user_prompts')
      .select('id, version, version_label, created_at, content')
      .eq('user_id', user.id)
      .eq('prompt_key', key)
      .order('version', { ascending: false })

    return NextResponse.json({
      key,
      content: activeRow ? activeRow.content : DEFAULT_PROMPTS[key].content,
      version: activeRow ? activeRow.version : 0,
      model: activeRow?.model ?? 'claude-haiku-4-5-20251001',
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
    const { content, version_label, model } = body as {
      content?: string
      version_label?: string
      model?: string
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    if (content.trim().length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt content exceeds ${MAX_PROMPT_LENGTH.toLocaleString()} character limit` },
        { status: 400 },
      )
    }

    const resolvedModel =
      typeof model === 'string' && model.trim().length > 0
        ? model.trim()
        : 'claude-haiku-4-5-20251001'

    const inserted = await savePromptVersion(supabase, user.id, key, content, version_label, resolvedModel)

    return NextResponse.json(
      {
        id: inserted.id,
        key: inserted.prompt_key,
        content: inserted.content,
        version: inserted.version,
        model: inserted.model,
        created_at: inserted.created_at,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('POST /api/prompts/[key] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
