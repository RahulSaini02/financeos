import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { ImportStatus, TxnSource } from '@/lib/types'

interface ImportItem {
  raw_data: Record<string, unknown>
  parsed_merchant: string | null
  parsed_amount: number | null
  parsed_date: string | null
  parsed_last_four: string | null
  source: TxnSource
  suggested_category_id?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items } = body as { items: ImportItem[] }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Request body must include a non-empty "items" array' },
        { status: 400 }
      )
    }

    const rows = items.map((item) => ({
      user_id: user.id,
      raw_data: item.raw_data ?? {},
      parsed_merchant: item.parsed_merchant ?? null,
      parsed_amount: item.parsed_amount ?? null,
      parsed_date: item.parsed_date ?? null,
      parsed_last_four: item.parsed_last_four ?? null,
      source: item.source,
      status: 'pending' as ImportStatus,
      suggested_category_id: item.suggested_category_id ?? null,
    }))

    const { data, error } = await supabase
      .from('pending_imports')
      .insert(rows)
      .select('id')

    if (error) {
      console.error('pending_imports insert error:', error)
      return NextResponse.json({ error: 'Failed to create import records' }, { status: 500 })
    }

    return NextResponse.json({ created: data?.length ?? 0 }, { status: 201 })
  } catch (err) {
    console.error('imports POST error:', err)
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

    const body = await request.json()
    const { id, ...fields } = body as { id: string } & Partial<Record<string, unknown>>

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: '"id" is required' }, { status: 400 })
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pending_imports')
      .update(fields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('pending_imports update error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Import record not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update import record' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (err) {
    console.error('imports PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
