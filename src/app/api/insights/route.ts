import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { AiInsight } from '@/lib/types'

/**
 * GET /api/insights
 * Returns the most recent AI insights for the authenticated user.
 * Replaces the direct browser-client query that was in AiChatClient.tsx.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ insights: (data ?? []) as AiInsight[] })
}
