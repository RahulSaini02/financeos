import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'

// Service-role client — bypasses RLS for account balance updates that must
// succeed regardless of how the request arrived (direct UI call or internal
// server fetch). Only used AFTER user identity has been verified.
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Recalculate and persist the linked account's current_balance by summing
 * current_value of ALL investments that belong to that account + user.
 * Uses the admin client so the update is never blocked by RLS.
 */
async function syncAccountBalance(
  adminClient: ReturnType<typeof createAdminClient>,
  userSupabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  accountId: string,
  userId: string,
): Promise<void> {
  // Sum remaining investments for this account scoped to the user
  const { data: investments, error: sumErr } = await userSupabase
    .from('investments')
    .select('current_value')
    .eq('account_id', accountId)
    .eq('user_id', userId)

  if (sumErr) {
    console.error('Investment sum error for account balance sync:', sumErr)
    return
  }

  const total = (investments ?? []).reduce(
    (acc, inv) => acc + (Number(inv.current_value) ?? 0),
    0,
  )

  const { error: updateErr } = await adminClient
    .from('accounts')
    .update({ current_balance: total, last_updated: new Date().toISOString() })
    .eq('id', accountId)

  if (updateErr) {
    console.error('Account balance update error during investment sync:', updateErr)
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const accountId = searchParams.get('account_id')

    let query = supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Investments fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch investments' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('Investments GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: Record<string, unknown> = await request.json()

    const { type, platform, ticker, total_invested, current_value, account_id, notes } = body

    // Required field validation
    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'type is required' }, { status: 400 })
    }
    if (!platform || typeof platform !== 'string') {
      return NextResponse.json({ error: 'platform is required' }, { status: 400 })
    }
    if (!ticker || typeof ticker !== 'string') {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
    }
    if (total_invested === undefined || total_invested === null || isNaN(Number(total_invested))) {
      return NextResponse.json({ error: 'total_invested is required and must be a number' }, { status: 400 })
    }
    if (current_value === undefined || current_value === null || isNaN(Number(current_value))) {
      return NextResponse.json({ error: 'current_value is required and must be a number' }, { status: 400 })
    }

    // If account_id is provided, verify it belongs to this user
    if (account_id) {
      const { data: acct, error: acctErr } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', account_id)
        .eq('user_id', user.id)
        .single()

      if (acctErr || !acct) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
    }

    const { data, error } = await supabase
      .from('investments')
      .insert({
        user_id: user.id,
        type,
        platform,
        ticker,
        total_invested: Number(total_invested),
        current_value: Number(current_value),
        account_id: account_id ?? null,
        notes: notes ?? null,
        last_updated: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Investment insert error:', error)
      return NextResponse.json({ error: 'Failed to create investment' }, { status: 500 })
    }

    // Sync linked account balance
    if (account_id && typeof account_id === 'string') {
      const adminClient = createAdminClient()
      await syncAccountBalance(adminClient, supabase, account_id, user.id)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('Investments POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: Record<string, unknown> = await request.json()
    const { id, ...payload } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Fetch existing investment to get the old account_id (needed for re-sync
    // if the account association changes)
    const { data: existing, error: fetchErr } = await supabase
      .from('investments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Investment not found' }, { status: 404 })
    }

    const oldAccountId: string | null = existing.account_id ?? null
    const newAccountId: string | null =
      'account_id' in payload
        ? (payload.account_id as string | null) ?? null
        : oldAccountId

    // If a new account_id is being set, verify it belongs to the user
    if (newAccountId && newAccountId !== oldAccountId) {
      const { data: acct, error: acctErr } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', newAccountId)
        .eq('user_id', user.id)
        .single()

      if (acctErr || !acct) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
    }

    // Build update payload — sanitize numeric fields
    const updatePayload: Record<string, unknown> = { ...payload }
    if ('total_invested' in updatePayload) {
      updatePayload.total_invested = Number(updatePayload.total_invested)
    }
    if ('current_value' in updatePayload) {
      updatePayload.current_value = Number(updatePayload.current_value)
    }
    updatePayload.last_updated = new Date().toISOString()

    const { data, error } = await supabase
      .from('investments')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Investment update error:', error)
      return NextResponse.json({ error: 'Failed to update investment' }, { status: 500 })
    }

    // Sync account balances — both the new and old account if the account changed
    const adminClient = createAdminClient()
    const accountsToSync = new Set<string>()
    if (newAccountId) accountsToSync.add(newAccountId)
    if (oldAccountId && oldAccountId !== newAccountId) accountsToSync.add(oldAccountId)

    await Promise.all(
      [...accountsToSync].map(acctId =>
        syncAccountBalance(adminClient, supabase, acctId, user.id),
      ),
    )

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Investments PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    // Fetch investment first to capture account_id before deletion
    const { data: existing, error: fetchErr } = await supabase
      .from('investments')
      .select('id, account_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Investment not found' }, { status: 404 })
    }

    const accountId: string | null = existing.account_id ?? null

    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Investment delete error:', error)
      return NextResponse.json({ error: 'Failed to delete investment' }, { status: 500 })
    }

    // Recalculate account balance from remaining investments
    if (accountId) {
      const adminClient = createAdminClient()
      await syncAccountBalance(adminClient, supabase, accountId, user.id)
    }

    return NextResponse.json({ success: true, message: 'Investment deleted' })
  } catch (err) {
    console.error('Investments DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
