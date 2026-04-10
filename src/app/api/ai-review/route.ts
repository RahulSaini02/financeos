import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function dateRange(period: 'week' | 'month'): { start: string; end: string; label: string } {
  const now = new Date()
  if (period === 'week') {
    const day = now.getDay() // 0=Sun
    const start = new Date(now)
    start.setDate(now.getDate() - day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      label: `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    }
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }
}

function previousDateRange(period: 'week' | 'month'): { start: string; end: string; numDays: number } {
  const now = new Date()
  if (period === 'week') {
    const day = now.getDay()
    const thisSunday = new Date(now)
    thisSunday.setDate(now.getDate() - day)
    thisSunday.setHours(0, 0, 0, 0)
    const prevSunday = new Date(thisSunday)
    prevSunday.setDate(thisSunday.getDate() - 7)
    const prevSat = new Date(prevSunday)
    prevSat.setDate(prevSunday.getDate() + 6)
    return {
      start: prevSunday.toISOString().split('T')[0],
      end: prevSat.toISOString().split('T')[0],
      numDays: 7,
    }
  }
  // previous month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  return {
    start: prevMonth.toISOString().split('T')[0],
    end: prevMonthEnd.toISOString().split('T')[0],
    numDays: prevMonthEnd.getDate(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const period = (request.nextUrl.searchParams.get('period') ?? 'month') as 'week' | 'month'
    const { start, end, label } = dateRange(period)
    const prev = previousDateRange(period)

    // Fetch transactions for the period + categories + budgets + previous period
    const [txRes, budgetRes, accountsRes, prevTxRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('description, amount_usd, cr_dr, date, category:categories(name, type)')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('budgets')
        .select('amount_usd, category:categories(name)')
        .eq('user_id', user.id),
      supabase
        .from('accounts')
        .select('name, kind, current_balance')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('transactions')
        .select('amount_usd, cr_dr')
        .eq('user_id', user.id)
        .gte('date', prev.start)
        .lte('date', prev.end),
    ])

    const transactions = txRes.data ?? []
    const budgets = budgetRes.data ?? []
    const accounts = accountsRes.data ?? []
    const prevTransactions = prevTxRes.data ?? []

    // Compute aggregates
    const income = transactions.filter(t => t.cr_dr === 'credit').reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)
    const expenses = transactions.filter(t => t.cr_dr === 'debit').reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)

    const byCategory: Record<string, { amount: number; count: number }> = {}
    for (const t of transactions) {
      if (t.cr_dr === 'debit') {
        const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
        if (!byCategory[cat]) byCategory[cat] = { amount: 0, count: 0 }
        byCategory[cat].amount += Math.abs(t.amount_usd ?? 0)
        byCategory[cat].count++
      }
    }

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 8)
      .map(([name, { amount, count }]) => ({ name, amount, count }))

    const dailySpend: Record<string, number> = {}
    for (const t of transactions) {
      if (t.cr_dr === 'debit') {
        dailySpend[t.date] = (dailySpend[t.date] ?? 0) + Math.abs(t.amount_usd ?? 0)
      }
    }

    const netWorth = accounts
      .reduce((s, a) => s + (a.kind === 'asset' || a.kind === 'investment' ? (a.current_balance ?? 0) : -(a.current_balance ?? 0)), 0)

    // Previous period average daily spend (for reference line)
    const prevExpenses = prevTransactions
      .filter(t => t.cr_dr === 'debit')
      .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)
    const previousAvgDaily = prev.numDays > 0 ? prevExpenses / prev.numDays : 0

    // Build AI prompt context
    const budgetLines = budgets.map(b => {
      const catName = (b.category as unknown as { name: string } | null)?.name ?? 'Unknown'
      const spent = byCategory[catName]?.amount ?? 0
      const pct = b.amount_usd > 0 ? ((spent / b.amount_usd) * 100).toFixed(0) : '0'
      return `- ${catName}: spent ${fmt(spent)} / ${fmt(b.amount_usd)} budget (${pct}%)`
    }).join('\n')

    const context = `
## Period: ${label}
- Total Income: ${fmt(income)}
- Total Expenses: ${fmt(expenses)}
- Net Cash Flow: ${fmt(income - expenses)}
- Net Worth: ${fmt(netWorth)}
- Transactions: ${transactions.length}

## Spending by Category
${topCategories.map(c => `- ${c.name}: ${fmt(c.amount)} (${c.count} txns)`).join('\n') || '- No spending data'}

## Budget vs Actual
${budgetLines || '- No budgets configured'}

## Daily Spending Pattern
${Object.entries(dailySpend).sort((a, b) => a[0].localeCompare(b[0])).map(([d, a]) => `- ${d}: ${fmt(a)}`).join('\n') || '- No daily data'}

## Top Individual Transactions
${transactions.filter(t => t.cr_dr === 'debit').sort((a, b) => Math.abs(b.amount_usd) - Math.abs(a.amount_usd)).slice(0, 5).map(t => `- ${t.description}: ${fmt(Math.abs(t.amount_usd))} on ${t.date}`).join('\n') || '- None'}
`.trim()

    // Generate AI analysis
    let analysis = ''
    if (process.env.ANTHROPIC_API_KEY) {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: `You are FinanceOS, a personal finance analyst. Analyze the user's financial data for the given period and provide actionable insights. Structure your response with these sections using markdown:

1. **Summary** — 2-3 sentence overview of the period
2. **Spending Highlights** — key patterns, top categories, anomalies (bullet points)
3. **Budget Health** — which categories are over/under budget, any concerns
4. **Recommendations** — 3 specific, actionable suggestions based on the data
5. **Outlook** — brief forward-looking comment

Be specific with numbers. Keep it practical and concise (under 400 words total).`,
        messages: [{ role: 'user', content: `Analyze my finances for ${label}:\n\n${context}` }],
      })
      analysis = msg.content[0].type === 'text' ? msg.content[0].text : ''

      // Save as insight
      await supabase.from('ai_insights').insert({
        user_id: user.id,
        type: period === 'week' ? 'weekly' : 'monthly',
        content: analysis,
        is_read: false,
      }).then(() => {})
    } else {
      analysis = `**Summary**\nYou spent ${fmt(expenses)} against ${fmt(income)} income this period, resulting in a ${income >= expenses ? 'positive' : 'negative'} cash flow of ${fmt(Math.abs(income - expenses))}.\n\n_AI analysis requires ANTHROPIC_API_KEY to be configured._`
    }

    return NextResponse.json({
      period,
      label,
      start,
      end,
      summary: { income, expenses, netCashFlow: income - expenses, netWorth, transactionCount: transactions.length },
      topCategories,
      dailySpend,
      previousAvgDaily,
      analysis,
    })
  } catch (err) {
    console.error('AI Review error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
