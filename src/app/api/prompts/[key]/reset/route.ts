// POST /api/prompts/[key]/reset
// Resets the prompt to its default content by saving a new version with
// the default text and version_label = 'Default reset'.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'
import { savePromptVersion } from '@/lib/save-prompt-version'

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

    const inserted = await savePromptVersion(
      supabase,
      user.id,
      key,
      DEFAULT_PROMPTS[key].content,
      'Default reset',
    )

    return NextResponse.json({
      content: inserted.content,
      version: inserted.version,
    })
  } catch (err) {
    console.error('POST /api/prompts/[key]/reset error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
