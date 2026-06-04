import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    // Determine update payload: if only is_active is present alongside id, treat
    // as a toggle; otherwise perform a full field update. Both paths are identical
    // in terms of the DB call — we just forward whatever fields were provided.
    const updatePayload: Record<string, unknown> = {}

    if ('is_active' in fields && Object.keys(fields).length === 1) {
      // Toggle-only path
      updatePayload.is_active = fields.is_active
    } else {
      // Full update path — whitelist known columns to avoid injecting arbitrary data
      const allowed = [
        'description',
        'amount_usd',
        'cr_dr',
        'frequency',
        'day_of_month',
        'next_due',
        'is_active',
        'account_id',
        'category_id',
        'notes',
      ] as const
      for (const key of allowed) {
        if (key in fields) {
          updatePayload[key] = fields[key as keyof typeof fields]
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('recurring_rules')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Recurring rule update error:', error)
      return NextResponse.json({ error: 'Failed to update recurring rule' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Recurring rules PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
      return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 })
    }

    const { error } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Recurring rule delete error:', error)
      return NextResponse.json({ error: 'Failed to delete recurring rule' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Recurring rules DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')

    let query = supabase
      .from('recurring_rules')
      .select('*, account:accounts(name), category:categories(name)')
      .eq('user_id', user.id)
      .order('next_due')

    if (status && status !== 'all') {
      const isActive = status === 'active'
      query = query.eq('is_active', isActive)
    }

    const { data, error } = await query

    if (error) {
      console.error('Recurring rules fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch recurring rules' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('Recurring rules GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      description,
      amount_usd,
      cr_dr,
      frequency,
      day_of_month,
      next_due,
      is_active,
      account_id,
      category_id,
      notes,
    } = body

    const { data, error } = await supabase
      .from('recurring_rules')
      .insert({
        user_id: user.id,
        description,
        amount_usd,
        cr_dr,
        frequency,
        day_of_month,
        next_due,
        is_active: is_active ?? true,
        account_id,
        category_id,
        notes,
      })
      .select()
      .single()

    if (error) {
      console.error('Recurring rule insert error:', error)
      return NextResponse.json({ error: 'Failed to create recurring rule' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Recurring rules POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
