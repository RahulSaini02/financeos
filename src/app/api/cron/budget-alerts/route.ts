import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/cron/budget-alerts
 * Runs daily. Checks all users' budgets for the current month.
 * For categories ≥ 80% spent → saves an alert AI insight.
 * For categories over budget → saves a warning AI insight.
 *
 * In a production app you would also send push/email here.
 * Authorize with: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const auth =
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    request.headers.get('x-cron-secret') ??
    ''
  if (auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createServerSupabaseClient()

    const now = new Date()
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const lastDay = new Date(nextMonth.getTime() - 1).toISOString().split('T')[0]

    // Get all budgets for current month with actual spend
    const { data: budgets, error: budgetsErr } = await supabase
      .from('budgets')
      .select('user_id, amount_usd, category:categories(id, name)')
      .eq('month', firstDay)

    if (budgetsErr) {
      return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
    }

    const alertsCreated: { userId: string; category: string; type: string }[] = []

    for (const budget of budgets ?? []) {
      const cat = budget.category as unknown as { id: string; name: string } | null
      if (!cat) continue

      // Get actual spend for this category this month
      const { data: txns } = await supabase
        .from('transactions')
        .select('amount_usd')
        .eq('user_id', budget.user_id)
        .eq('category_id', cat.id)
        .eq('cr_dr', 'debit')
        .gte('date', firstDay)
        .lte('date', lastDay)

      const spent = (txns ?? []).reduce((s, t) => s + Math.abs(t.amount_usd), 0)
      const pct = budget.amount_usd > 0 ? (spent / budget.amount_usd) * 100 : 0

      let alertContent: string | null = null
      let alertType: 'over_budget' | 'near_budget' | null = null

      if (pct >= 100) {
        alertContent = `⚠️ Budget Alert: You've exceeded your ${cat.name} budget ($${spent.toFixed(2)} spent of $${budget.amount_usd.toFixed(2)} budgeted — ${pct.toFixed(0)}% used).`
        alertType = 'over_budget'
      } else if (pct >= 80) {
        alertContent = `💡 Heads up: Your ${cat.name} budget is ${pct.toFixed(0)}% used ($${spent.toFixed(2)} of $${budget.amount_usd.toFixed(2)}). You have $${(budget.amount_usd - spent).toFixed(2)} remaining this month.`
        alertType = 'near_budget'
      }

      if (alertContent && alertType) {
        // Check if we've already sent this alert today (avoid duplicates)
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)
        const { data: existing } = await supabase
          .from('ai_insights')
          .select('id')
          .eq('user_id', budget.user_id)
          .eq('type', 'alert')
          .like('content', `%${cat.name} budget%`)
          .gte('created_at', todayStart.toISOString())
          .limit(1)

        if (!existing || existing.length === 0) {
          await supabase.from('ai_insights').insert({
            user_id: budget.user_id,
            type: 'alert',
            content: alertContent,
            is_read: false,
          })
          alertsCreated.push({ userId: budget.user_id, category: cat.name, type: alertType })
        }
      }
    }

    return NextResponse.json({ budgetsChecked: (budgets ?? []).length, alertsCreated })
  } catch (err) {
    console.error('Budget alerts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
