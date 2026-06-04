import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ids, ...fields } = body

    if (ids && Array.isArray(ids)) {
      // Bulk update (e.g. mark all as read)
      const { error } = await supabase
        .from('ai_insights')
        .update(fields)
        .in('id', ids)
        .eq('user_id', user.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ updated: ids.length })
    }

    if (id) {
      const { error } = await supabase
        .from('ai_insights')
        .update(fields)
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ updated: 1 })
    }

    return NextResponse.json({ error: 'Missing id or ids' }, { status: 400 })
  } catch (err) {
    console.error('AI insights PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
