import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('connected_email, updated_at')
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')
      .maybeSingle()

    if (!integration) {
      return NextResponse.json({ connected: false, email: null, last_synced: null })
    }

    return NextResponse.json({
      connected: true,
      email: integration.connected_email ?? null,
      last_synced: integration.updated_at ?? null,
    })
  } catch (err) {
    console.error('Google Calendar status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')

    if (error) {
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Google Calendar disconnect error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
