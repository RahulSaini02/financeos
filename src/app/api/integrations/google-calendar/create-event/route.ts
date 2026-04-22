import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createCalendarEvent, refreshAccessToken } from '@/lib/google-oauth'

interface CreateEventBody {
  title: string
  date: string
  description?: string
  subscription_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateEventBody

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!body.date || typeof body.date !== 'string') {
      return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const { data: integrations, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')
      .order('created_at', { ascending: false })
      .limit(1)

    const integration = integrations?.[0] ?? null

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 404 })
    }

    let accessToken: string = integration.access_token

    // Refresh if token expires within 5 minutes
    if (integration.token_expires_at) {
      const expiresAt = new Date(integration.token_expires_at).getTime()
      const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
      if (expiresAt < fiveMinutesFromNow && integration.refresh_token) {
        const refreshed = await refreshAccessToken(integration.refresh_token)
        accessToken = refreshed.access_token
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

        await supabase
          .from('user_integrations')
          .update({ access_token: accessToken, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq('id', integration.id)
      }
    }

    // Compute next day for all-day event end date
    const startDate = new Date(body.date)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)
    const endDateStr = endDate.toISOString().split('T')[0]

    const created = await createCalendarEvent(accessToken, {
      summary: body.title,
      description: body.description,
      start: { date: body.date },
      end: { date: endDateStr },
    })

    // If subscription_id provided, persist a calendar_events row
    if (body.subscription_id && typeof body.subscription_id === 'string') {
      await supabase.from('calendar_events').upsert(
        {
          user_id: user.id,
          google_event_id: created.id,
          title: body.title,
          description: body.description ?? null,
          start_date: body.date,
          end_date: endDateStr,
          is_bill_reminder: true,
          linked_subscription_id: body.subscription_id,
          google_calendar_id: 'primary',
        },
        { onConflict: 'user_id,google_event_id' },
      )
    }

    return NextResponse.json({ success: true, eventId: created.id, htmlLink: created.htmlLink })
  } catch (err) {
    console.error('Google Calendar create-event error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
