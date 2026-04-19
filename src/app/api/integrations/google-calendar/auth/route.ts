import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getGoogleAuthUrl } from '@/lib/google-oauth'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const state = `${user.id}:${randomUUID()}`
    const url = getGoogleAuthUrl(state)

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('Google Calendar auth error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
