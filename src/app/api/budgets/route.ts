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
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const month = searchParams.get('month') ?? defaultMonth

    const monthDate = new Date(month)
    const nextMonthDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

    const [budgetsRes, transactionsRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .eq('month', month),
      supabase
        .from('transactions')
        .select('amount_usd, category_id')
        .eq('user_id', user.id)
        .eq('cr_dr', 'debit')
        .gte('date', month)
        .lt('date', nextMonth),
    ])

    if (budgetsRes.error) {
      console.error('Budgets fetch error:', budgetsRes.error)
      return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
    }

    const budgets = budgetsRes.data ?? []
    const transactions = transactionsRes.data ?? []

    // Group actual spend by category_id
    const spendByCategory: Record<string, number> = {}
    for (const t of transactions) {
      if (t.category_id) {
        spendByCategory[t.category_id] = (spendByCategory[t.category_id] ?? 0) + (t.amount_usd ?? 0)
      }
    }

    const budgetsWithActual = budgets.map((budget) => {
      const actual_spend = spendByCategory[budget.category_id] ?? 0
      const remaining = (budget.amount_usd ?? 0) - actual_spend
      let progress_status: string
      const ratio = budget.amount_usd > 0 ? actual_spend / budget.amount_usd : 0
      if (ratio >= 1) {
        progress_status = 'over_budget'
      } else if (ratio >= 0.8) {
        progress_status = 'at_risk'
      } else {
        progress_status = 'on_track'
      }

      return {
        ...budget,
        actual_spend,
        remaining,
        progress_status,
      }
    })

    return NextResponse.json(budgetsWithActual)
  } catch (err) {
    console.error('Budgets GET error:', err)
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
    const { category_id, month, amount_usd } = body

    const { data, error } = await supabase
      .from('budgets')
      .upsert(
        {
          user_id: user.id,
          category_id,
          month,
          amount_usd,
        },
        { onConflict: 'user_id,category_id,month' }
      )
      .select()
      .single()

    if (error) {
      console.error('Budget upsert error:', error)
      return NextResponse.json({ error: 'Failed to create/update budget' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Budgets POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
