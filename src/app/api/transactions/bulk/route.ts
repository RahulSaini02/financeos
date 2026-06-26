import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ─── Request types ────────────────────────────────────────────────────────────

type BulkAction = 'delete' | 'recategorize'

interface BulkDeleteBody {
  action: 'delete'
  ids: string[]
}

interface BulkRecategorizeBody {
  action: 'recategorize'
  ids: string[]
  category_id: string
}

type BulkRequestBody = BulkDeleteBody | BulkRecategorizeBody

// ─── POST /api/transactions/bulk ──────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse body ────────────────────────────────────────────────────────────

    let body: BulkRequestBody
    try {
      body = (await request.json()) as BulkRequestBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { action, ids } = body

    // ── Validate action ───────────────────────────────────────────────────────

    const validActions: BulkAction[] = ['delete', 'recategorize']
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: 'action must be "delete" or "recategorize"' },
        { status: 400 },
      )
    }

    // ── Validate ids ──────────────────────────────────────────────────────────

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array' },
        { status: 400 },
      )
    }

    if (ids.length > 500) {
      return NextResponse.json(
        { error: 'ids must contain at most 500 entries' },
        { status: 400 },
      )
    }

    // Ensure every element is a non-empty string (basic UUID guard)
    if (ids.some((id) => typeof id !== 'string' || !id.trim())) {
      return NextResponse.json(
        { error: 'All ids must be non-empty strings' },
        { status: 400 },
      )
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    if (action === 'delete') {
      const { error: deleteError, count } = await supabase
        .from('transactions')
        .delete({ count: 'exact' })
        .in('id', ids)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('[POST /api/transactions/bulk] delete error:', deleteError)
        return NextResponse.json({ error: 'Failed to delete transactions' }, { status: 500 })
      }

      return NextResponse.json({ success: true, count: count ?? 0 })
    }

    // ── Recategorize ──────────────────────────────────────────────────────────

    // TypeScript narrowing: action === 'recategorize' at this point
    const recatBody = body as BulkRecategorizeBody

    if (!recatBody.category_id || typeof recatBody.category_id !== 'string') {
      return NextResponse.json(
        { error: 'category_id is required when action is "recategorize"' },
        { status: 400 },
      )
    }

    const { category_id } = recatBody

    // Verify the category belongs to this user before applying it.
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('id', category_id)
      .eq('user_id', user.id)
      .single()

    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      )
    }

    const { error: updateError, count } = await supabase
      .from('transactions')
      .update({ category_id })
      .in('id', ids)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[POST /api/transactions/bulk] update error:', updateError)
      return NextResponse.json({ error: 'Failed to recategorize transactions' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: count ?? ids.length })
  } catch (err) {
    console.error('[POST /api/transactions/bulk] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
