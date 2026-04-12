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
    const { name, type, icon, monthly_budget, is_recurring, due_day, priority, notes } = body

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: 'Category name cannot be empty' }, { status: 400 })
    }
    if (type !== undefined && !['expense', 'income', 'transfer'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (type !== undefined) updates.type = type
    if (icon !== undefined) updates.icon = icon?.trim() || null
    if (monthly_budget !== undefined) updates.monthly_budget = monthly_budget || null
    if (is_recurring !== undefined) updates.is_recurring = is_recurring
    if (due_day !== undefined) updates.due_day = due_day || null
    if (priority !== undefined) updates.priority = priority || null
    if (notes !== undefined) updates.notes = notes?.trim() || null

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Category update error:', error)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    // Keep budgets table in sync: upsert the current month's row when monthly_budget changes
    if (monthly_budget !== undefined && monthly_budget > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
      await supabase
        .from('budgets')
        .upsert(
          { user_id: user.id, category_id: id, month: currentMonth, amount_usd: monthly_budget },
          { onConflict: 'user_id,category_id,month' }
        )
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Categories PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
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
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Category delete error:', error)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Categories DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
