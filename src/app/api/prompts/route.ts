// GET /api/prompts
// Returns all 5 prompt keys with active content (user override or default).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const keys = Object.keys(DEFAULT_PROMPTS)

    // Fetch all active user prompts in one query
    const { data: userPrompts, error: dbError } = await supabase
      .from('user_prompts')
      .select('prompt_key, content, version')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('prompt_key', keys)

    if (dbError) {
      console.error('prompts list fetch error:', dbError)
      return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
    }

    // Build a lookup map from DB results
    const dbMap: Record<string, { content: string; version: number }> = {}
    for (const row of userPrompts ?? []) {
      dbMap[row.prompt_key] = { content: row.content, version: row.version }
    }

    const prompts = keys.map((key) => {
      const meta = DEFAULT_PROMPTS[key]
      const override = dbMap[key]
      return {
        key: meta.key,
        label: meta.label,
        description: meta.description,
        content: override ? override.content : meta.content,
        version: override ? override.version : 0,
        isDefault: !override,
      }
    })

    return NextResponse.json({ prompts })
  } catch (err) {
    console.error('GET /api/prompts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
