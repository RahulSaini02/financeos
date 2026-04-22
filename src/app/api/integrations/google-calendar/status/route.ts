import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('id, connected_email, updated_at')
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')
      .order('created_at', { ascending: true })

    return NextResponse.json({
      connections: (integrations ?? []).map((i) => ({
        id: i.id,
        email: i.connected_email ?? null,
        last_synced: i.updated_at ?? null,
      })),
    })
  } catch (err) {
    console.error('Google Calendar status error:', err)
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

    const email = request.nextUrl.searchParams.get('email')

    let query = supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')

    if (email) {
      query = query.eq('connected_email', email)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Google Calendar disconnect error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
