import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ session_id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session_id } = await params

    const { data, error } = await supabase
      .from('conversation_messages')
      .select('id, session_id, role, content, mode, created_at')
      .eq('user_id', user.id)
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch session messages' }, { status: 500 })
    }

    return NextResponse.json({ messages: data ?? [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
