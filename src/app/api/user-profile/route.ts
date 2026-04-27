// GET  /api/user-profile  — returns the current user's profile fields
// PATCH /api/user-profile — submits an AI access request (updates ai_access_requested_at + reason only)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { UserProfile } from '@/lib/types'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email_verified, ai_enabled, ai_access_requested_at, ai_access_requested_reason, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('GET /api/user-profile error:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    // Old user before migration — return safe defaults
    if (!profile) {
      const defaults: UserProfile = {
        id: user.id,
        role: 'user',
        email_verified: false,
        ai_enabled: false,
        ai_access_requested_at: null,
        ai_access_requested_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return NextResponse.json({ data: defaults })
    }

    return NextResponse.json({ data: profile as UserProfile })
  } catch (err) {
    console.error('GET /api/user-profile error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { reason?: unknown }

    const reason = body.reason
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    if (reason.trim().length > 2000) {
      return NextResponse.json({ error: 'reason must be 2000 characters or less' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        ai_access_requested_at: new Date().toISOString(),
        ai_access_requested_reason: reason.trim(),
      })
      .eq('id', user.id)
      .select('id, role, email_verified, ai_enabled, ai_access_requested_at, ai_access_requested_reason, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('PATCH /api/user-profile error:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ data: updated as UserProfile })
  } catch (err) {
    console.error('PATCH /api/user-profile error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
