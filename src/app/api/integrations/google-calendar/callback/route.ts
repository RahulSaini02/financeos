import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens, getGoogleUserEmail } from '@/lib/google-oauth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role config')
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const settingsBase = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/settings`

  if (!code || !state) {
    return NextResponse.redirect(`${settingsBase}?integration=google_calendar_error`)
  }

  // Extract userId from state: format is `{userId}:{randomUUID}`
  const colonIndex = state.indexOf(':')
  if (colonIndex === -1) {
    return NextResponse.redirect(`${settingsBase}?integration=google_calendar_error`)
  }
  const userId = state.substring(0, colonIndex)

  if (!userId) {
    return NextResponse.redirect(`${settingsBase}?integration=google_calendar_error`)
  }

  // Verify the session user matches the userId from state (defense-in-depth)
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user: sessionUser } } = await supabaseAuth.auth.getUser()
  if (!sessionUser || sessionUser.id !== userId) {
    return NextResponse.redirect(`${settingsBase}?integration=google_calendar_error`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    const connectedEmail = await getGoogleUserEmail(tokens.access_token)

    // Count existing integrations, excluding the same email (re-auth case)
    const { count } = await supabaseAuth
      .from('user_integrations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('provider', 'google_calendar')
      .neq('connected_email', connectedEmail)

    if ((count ?? 0) >= 2) {
      return NextResponse.redirect(`${settingsBase}?integration=google_calendar_error&reason=max_calendars`)
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const supabase = createServiceRoleClient()

    const { error } = await supabase
      .from('user_integrations')
      .upsert(
        {
          user_id: userId,
          provider: 'google_calendar',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: tokenExpiresAt,
          connected_email: connectedEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider,connected_email' },
      )

    if (error) {
      console.error('Failed to upsert user_integrations:', error.message)
      return NextResponse.redirect(`${settingsBase}?integration=google_calendar_error`)
    }

    return NextResponse.redirect(`${settingsBase}?integration=google_calendar_connected`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Google Calendar callback error:', msg)
    return NextResponse.redirect(`${settingsBase}?integration=google_calendar_error&reason=${encodeURIComponent(msg)}`)
  }
}
