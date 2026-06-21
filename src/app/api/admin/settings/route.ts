// GET  /api/admin/settings  — list all app_settings rows (admin only)
// PUT  /api/admin/settings  — update a model setting by key (admin only, validated values)
// POST /api/admin/settings  — upsert a free-text setting by key (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const ALLOWED_KEYS = [
  'ai_model_daily_insight',
  'ai_model_monthly_summary',
  'ai_model_monthly_review',
  'ai_model_auto_categorize',
  'ai_model_agent_default',
] as const

// Keys that accept free-text values (not constrained to model names)
const FREE_TEXT_KEYS = ['ai_agent_system_prompt', 'ai_models_registry'] as const

// Model ID validation: allow any non-empty string so custom registry models work.
// Invalid IDs will fail at Anthropic's API, not silently here.

interface PutBody {
  key?: unknown
  value?: unknown
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

    const { data: settings, error: settingsError } = await serviceClient
      .from('app_settings')
      .select('key, value, updated_at, updated_by')
      .order('key', { ascending: true })

    if (settingsError) {
      console.error('GET /api/admin/settings error:', settingsError)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    return NextResponse.json({ settings: settings ?? [] })
  } catch (err) {
    console.error('GET /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
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

    const body = await request.json() as PutBody
    const { key, value } = body

    if (typeof key !== 'string' || !(ALLOWED_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        { error: `key must be one of: ${ALLOWED_KEYS.join(', ')}` },
        { status: 400 },
      )
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      return NextResponse.json({ error: 'value must be a non-empty string' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    const { data: updated, error: upsertError } = await serviceClient
      .from('app_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: 'key' },
      )
      .select('key, value, updated_at, updated_by')
      .single()

    if (upsertError) {
      console.error('PUT /api/admin/settings error:', upsertError)
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json({ data: updated, success: true })
  } catch (err) {
    console.error('PUT /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST — free-text settings (e.g. ai_chat_system_prompt) ───────────────────

export async function POST(request: NextRequest) {
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

    const body = await request.json() as PutBody
    const { key, value } = body

    if (typeof key !== 'string' || !(FREE_TEXT_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        { error: `key must be one of: ${FREE_TEXT_KEYS.join(', ')}` },
        { status: 400 },
      )
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      return NextResponse.json({ error: 'value must be a non-empty string' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    const { data: updated, error: upsertError } = await serviceClient
      .from('app_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: 'key' },
      )
      .select('key, value, updated_at, updated_by')
      .single()

    if (upsertError) {
      console.error('POST /api/admin/settings error:', upsertError)
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json({ data: updated, success: true })
  } catch (err) {
    console.error('POST /api/admin/settings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
