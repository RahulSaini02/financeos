import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('extracted_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('GET /api/user/memory error:', error)
      return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('GET /api/user/memory unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    const { id, all } = body as { id?: unknown; all?: unknown }

    if (all === true) {
      // Soft-delete all active memories for this user
      const { error } = await supabase
        .from('user_memory')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (error) {
        console.error('DELETE /api/user/memory (all) error:', error)
        return NextResponse.json({ error: 'Failed to delete memories' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'All memories cleared' })
    }

    if (id !== undefined) {
      if (typeof id !== 'string') {
        return NextResponse.json({ error: 'id must be a string' }, { status: 400 })
      }

      // Soft-delete a single memory — must belong to this user
      const { error } = await supabase
        .from('user_memory')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (error) {
        console.error('DELETE /api/user/memory (single) error:', error)
        return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Memory deleted' })
    }

    return NextResponse.json(
      { error: 'Provide either id (string) or all: true' },
      { status: 400 },
    )
  } catch (err) {
    console.error('DELETE /api/user/memory unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
