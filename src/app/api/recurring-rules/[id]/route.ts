import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const { data, error } = await supabase
      .from('recurring_rules')
      .update({
        description: body.description,
        amount_usd: body.amount_usd,
        cr_dr: body.cr_dr,
        frequency: body.frequency,
        day_of_month: body.day_of_month,
        next_due: body.next_due,
        is_active: body.is_active,
        account_id: body.account_id,
        category_id: body.category_id,
        notes: body.notes,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Recurring rule update error:', error)
      return NextResponse.json({ error: 'Failed to update recurring rule' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Recurring rule PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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
    console.error('Recurring rule DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
