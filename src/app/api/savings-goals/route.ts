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
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Savings goals fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch savings goals' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('Savings goals GET error:', err)
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
    const { name, target_amount, current_amount, monthly_contribution, status, icon, notes, linked_account_id } = body

    const { data, error } = await supabase
      .from('savings_goals')
      .insert({
        user_id: user.id,
        name,
        target_amount,
        current_amount: current_amount ?? 0,
        monthly_contribution: monthly_contribution ?? 0,
        status: status ?? 'active',
        icon,
        notes,
        linked_account_id,
      })
      .select()
      .single()

    if (error) {
      console.error('Savings goal insert error:', error)
      return NextResponse.json({ error: 'Failed to create savings goal' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Savings goals POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
