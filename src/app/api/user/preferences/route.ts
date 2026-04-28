import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { UserFinancialPreferencesPayload, CommunicationStyle, RiskTolerance } from '@/lib/types'

const VALID_COMMUNICATION_STYLES: CommunicationStyle[] = ['brief', 'balanced', 'detailed']
const VALID_RISK_TOLERANCES: RiskTolerance[] = ['conservative', 'moderate', 'aggressive']

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_financial_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('GET /api/user/preferences error:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? null })
  } catch (err) {
    console.error('GET /api/user/preferences unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    const raw = body as Record<string, unknown>
    const payload: UserFinancialPreferencesPayload = {}

    // Validate spending_priorities
    if ('spending_priorities' in raw) {
      if (!Array.isArray(raw.spending_priorities) || !raw.spending_priorities.every((x) => typeof x === 'string')) {
        return NextResponse.json({ error: 'spending_priorities must be an array of strings' }, { status: 400 })
      }
      payload.spending_priorities = raw.spending_priorities as string[]
    }

    // Validate financial_goals
    if ('financial_goals' in raw) {
      if (!Array.isArray(raw.financial_goals) || !raw.financial_goals.every((x) => typeof x === 'string')) {
        return NextResponse.json({ error: 'financial_goals must be an array of strings' }, { status: 400 })
      }
      payload.financial_goals = raw.financial_goals as string[]
    }

    // Validate communication_style
    if ('communication_style' in raw) {
      if (!VALID_COMMUNICATION_STYLES.includes(raw.communication_style as CommunicationStyle)) {
        return NextResponse.json(
          { error: `communication_style must be one of: ${VALID_COMMUNICATION_STYLES.join(', ')}` },
          { status: 400 },
        )
      }
      payload.communication_style = raw.communication_style as CommunicationStyle
    }

    // Validate alert_preferences
    if ('alert_preferences' in raw) {
      if (!Array.isArray(raw.alert_preferences) || !raw.alert_preferences.every((x) => typeof x === 'string')) {
        return NextResponse.json({ error: 'alert_preferences must be an array of strings' }, { status: 400 })
      }
      payload.alert_preferences = raw.alert_preferences as string[]
    }

    // Validate risk_tolerance (nullable)
    if ('risk_tolerance' in raw) {
      if (raw.risk_tolerance !== null && !VALID_RISK_TOLERANCES.includes(raw.risk_tolerance as RiskTolerance)) {
        return NextResponse.json(
          { error: `risk_tolerance must be one of: ${VALID_RISK_TOLERANCES.join(', ')} or null` },
          { status: 400 },
        )
      }
      payload.risk_tolerance = (raw.risk_tolerance as RiskTolerance | null)
    }

    // Validate custom_instructions (nullable string)
    if ('custom_instructions' in raw) {
      if (raw.custom_instructions !== null && typeof raw.custom_instructions !== 'string') {
        return NextResponse.json({ error: 'custom_instructions must be a string or null' }, { status: 400 })
      }
      payload.custom_instructions = raw.custom_instructions as string | null
    }

    const { data, error } = await supabase
      .from('user_financial_preferences')
      .upsert(
        { user_id: user.id, ...payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select()
      .single()

    if (error) {
      console.error('PUT /api/user/preferences error:', error)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('PUT /api/user/preferences unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
