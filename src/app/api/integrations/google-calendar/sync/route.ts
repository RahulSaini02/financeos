import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCalendarEvents, refreshAccessToken, GoogleCalendarEvent } from '@/lib/google-oauth'

const FINANCIAL_KEYWORDS = /rent|mortgage|payment|bill|subscription|insurance|loan|due|invoice/i
const BILL_KEYWORDS = /bill|payment|due|invoice|subscription/i
const COST_PATTERN = /\$[\d,]+\.?\d*/

function extractCost(text: string): number | null {
  const match = text.match(COST_PATTERN)
  if (!match) return null
  const cleaned = match[0].replace(/[$,]/g, '')
  const val = parseFloat(cleaned)
  return isNaN(val) ? null : val
}

function isFinancialEvent(event: GoogleCalendarEvent): boolean {
  const text = `${event.summary ?? ''} ${event.description ?? ''}`
  return FINANCIAL_KEYWORDS.test(text) || COST_PATTERN.test(text)
}

function isBillReminder(event: GoogleCalendarEvent): boolean {
  const text = `${event.summary ?? ''} ${event.description ?? ''}`
  return BILL_KEYWORDS.test(text)
}

function getEventDate(
  dateField: { date?: string; dateTime?: string } | undefined,
): string | null {
  if (!dateField) return null
  if (dateField.date) return dateField.date
  if (dateField.dateTime) return dateField.dateTime.split('T')[0]
  return null
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: integrations, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')

    if (integrationError || !integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 404 })
    }

    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()

    const rows: {
      user_id: string
      google_event_id: string
      title: string
      description: string | null
      start_date: string
      end_date: string | null
      estimated_cost: number | null
      currency: string
      is_bill_reminder: boolean
      google_calendar_id: string
    }[] = []

    let totalSynced = 0

    for (const integration of integrations) {
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

      const events = await getCalendarEvents(accessToken, timeMin, timeMax)
      totalSynced += events.length

      const financialEvents = events.filter(isFinancialEvent)

      for (const event of financialEvents) {
        const combinedText = `${event.summary ?? ''} ${event.description ?? ''}`
        const startDate = getEventDate(event.start)
        const endDate = getEventDate(event.end)
        const estimatedCost = extractCost(combinedText)

        rows.push({
          user_id: user.id,
          google_event_id: event.id,
          title: event.summary ?? '(no title)',
          description: event.description ?? null,
          start_date: startDate ?? now.toISOString().split('T')[0],
          end_date: endDate ?? null,
          estimated_cost: estimatedCost,
          currency: 'USD',
          is_bill_reminder: isBillReminder(event),
          google_calendar_id: integration.connected_email ?? 'primary',
        })
      }

      // Update last synced timestamp for this integration
      await supabase
        .from('user_integrations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', integration.id)
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(rows, { onConflict: 'user_id,google_event_id' })

      if (upsertError) {
        console.error('Calendar events upsert error:', upsertError.message)
        return NextResponse.json({ error: 'Failed to save events' }, { status: 500 })
      }
    }

    return NextResponse.json({ synced: totalSynced, financial_events: rows.length })
  } catch (err) {
    console.error('Google Calendar sync error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
