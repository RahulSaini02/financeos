import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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
