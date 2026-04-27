// GET   /api/admin/users           — list all user profiles (admin only)
// PATCH /api/admin/users           — update a user's role/ai_enabled/email_verified (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type AdminAction = 'approve_ai' | 'revoke_ai' | 'set_admin' | 'verify_email'

interface PatchBody {
  userId?: unknown
  action?: unknown
}

// Creates a Supabase client using the service role key (bypasses RLS)
function createServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

// Verifies the requesting user is an admin by checking their profile via service role
async function verifyAdmin(userId: string): Promise<boolean> {
  const serviceClient = createServiceRoleClient()
  const { data } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return data?.role === 'admin'
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceClient = createServiceRoleClient()

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id, role, email_verified, ai_enabled, ai_access_requested_at, ai_access_requested_reason, created_at')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('GET /api/admin/users profiles error:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    // Fetch emails from auth.users via admin API
    const { data: { users: authUsers }, error: authUsersError } = await serviceClient.auth.admin.listUsers()

    if (authUsersError) {
      console.error('GET /api/admin/users auth error:', authUsersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Join profiles with email
    const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))

    const result = (profiles ?? []).map((p) => ({
      id: p.id,
      email: emailMap.get(p.id) ?? '',
      role: p.role,
      email_verified: p.email_verified,
      ai_enabled: p.ai_enabled,
      ai_access_requested_at: p.ai_access_requested_at,
      ai_access_requested_reason: p.ai_access_requested_reason,
      created_at: p.created_at,
    }))

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('GET /api/admin/users error:', err)
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

    const isAdmin = await verifyAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json() as PatchBody
    const { userId, action } = body

    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const validActions: AdminAction[] = ['approve_ai', 'revoke_ai', 'set_admin', 'verify_email']
    if (typeof action !== 'string' || !validActions.includes(action as AdminAction)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 },
      )
    }

    const updates: Record<string, unknown> = {}
    switch (action as AdminAction) {
      case 'approve_ai':
        updates.ai_enabled = true
        break
      case 'revoke_ai':
        updates.ai_enabled = false
        break
      case 'set_admin':
        updates.role = 'admin'
        break
      case 'verify_email':
        updates.email_verified = true
        break
    }

    const serviceClient = createServiceRoleClient()
    const { data: updated, error: updateError } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, role, email_verified, ai_enabled, ai_access_requested_at, ai_access_requested_reason')
      .single()

    if (updateError) {
      console.error('PATCH /api/admin/users error:', updateError)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({ data: updated, success: true })
  } catch (err) {
    console.error('PATCH /api/admin/users error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
