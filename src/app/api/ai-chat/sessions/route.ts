import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface RawMessage {
  session_id: string
  role: string
  content: string
  mode: string
  created_at: string
}

interface SessionSummary {
  session_id: string
  first_message: string
  message_count: number
  created_at: string
  last_message_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? 'agent'

    const { data, error } = await supabase
      .from('conversation_messages')
      .select('session_id, role, content, mode, created_at')
      .eq('user_id', user.id)
      .eq('mode', mode)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    const rows = (data ?? []) as RawMessage[]

    // Group by session_id in JS
    const sessionMap = new Map<string, {
      first_user_message: string
      message_count: number
      created_at: string
      last_message_at: string
    }>()

    // rows are desc — iterate to collect per session
    for (const row of rows) {
      const existing = sessionMap.get(row.session_id)
      if (!existing) {
        sessionMap.set(row.session_id, {
          first_user_message: row.role === 'user' ? row.content : '',
          message_count: 1,
          created_at: row.created_at,
          last_message_at: row.created_at,
        })
      } else {
        existing.message_count += 1
        // Since rows are desc, the current row is older, so it's the earlier message
        existing.created_at = row.created_at
        if (row.role === 'user') {
          // Keep the earliest user message as the preview
          existing.first_user_message = row.content
        }
      }
    }

    const sessions: SessionSummary[] = Array.from(sessionMap.entries())
      .map(([session_id, s]) => ({
        session_id,
        first_message: (s.first_user_message || 'Session').slice(0, 80),
        message_count: s.message_count,
        created_at: s.created_at,
        last_message_at: s.last_message_at,
      }))
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      .slice(0, 20)

    return NextResponse.json({ sessions })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
