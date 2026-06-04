import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { AccountType, AccountKind, CurrencyCode } from '@/lib/types'

// ─── POST /api/accounts — Create a new account ───────────────────────────────

interface CreateAccountBody {
  name: string
  type: AccountType
  kind: AccountKind
  institution?: string | null
  last_four?: string | null
  currency?: CurrencyCode
  current_balance?: number
  opening_balance?: number
  is_active?: boolean
  is_india_account?: boolean
  notes?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: CreateAccountBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { name, type, kind } = body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 })
    }
    if (!kind) {
      return NextResponse.json({ error: 'kind is required' }, { status: 400 })
    }

    const insertPayload = {
      user_id: user.id,
      name: name.trim(),
      type,
      kind,
      institution: body.institution ?? null,
      last_four: body.last_four ?? null,
      currency: body.currency ?? 'USD',
      current_balance: body.current_balance ?? 0,
      opening_balance: body.opening_balance ?? 0,
      is_active: body.is_active ?? true,
      is_india_account: body.is_india_account ?? false,
      notes: body.notes ?? null,
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('[POST /api/accounts] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/accounts] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PUT /api/accounts — Update account (full update, soft-delete, or toggle) ─

interface UpdateAccountBody {
  id: string
  name?: string
  type?: AccountType
  kind?: AccountKind
  institution?: string | null
  last_four?: string | null
  currency?: CurrencyCode
  current_balance?: number
  opening_balance?: number
  is_active?: boolean
  is_india_account?: boolean
  notes?: string | null
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: UpdateAccountBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { id, ...fields } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 })
    }

    // Strip undefined values — only send explicitly provided fields to Supabase
    const updatePayload = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    )

    const { data, error } = await supabase
      .from('accounts')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows matched — account not found or doesn't belong to user
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
      console.error('[PUT /api/accounts] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (err) {
    console.error('[PUT /api/accounts] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
