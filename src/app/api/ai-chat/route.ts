import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { question } = body as { question: string }

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }

    const now = new Date()
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`

    // Fetch all financial context in parallel
    const [
      accountsRes,
      transactionsRes,
      loansRes,
      investmentsRes,
      budgetsRes,
      subscriptionsRes,
      savingsGoalsRes,
    ] = await Promise.all([
      supabase.from('accounts').select('name, kind, type, current_balance, currency').eq('user_id', user.id).eq('is_active', true),
      supabase.from('transactions').select('description, amount_usd, cr_dr, date, category:categories(name)').eq('user_id', user.id).gte('date', firstDay).lt('date', nextMonth),
      supabase.from('loans').select('name, type, current_balance, interest_rate, emi, start_date, term_months').eq('user_id', user.id),
      supabase.from('investments').select('ticker, type, platform, total_invested, current_value').eq('user_id', user.id),
      supabase.from('budgets').select('amount_usd, category:categories(name)').eq('user_id', user.id).eq('month', firstDay),
      supabase.from('subscriptions').select('name, billing_cost, billing_cycle_months, status, next_billing_date').eq('user_id', user.id),
      supabase.from('savings_goals').select('name, target_amount, current_amount, monthly_contribution, status').eq('user_id', user.id),
    ])

    const accounts = accountsRes.data ?? []
    const transactions = transactionsRes.data ?? []
    const loans = loansRes.data ?? []
    const investments = investmentsRes.data ?? []
    const rawBudgets = budgetsRes.data ?? []
    const subscriptions = subscriptionsRes.data ?? []
    const savingsGoals = savingsGoalsRes.data ?? []

    // Compute derived values for context
    const totalAssets = accounts.filter(a => a.kind === 'asset' || a.kind === 'investment').reduce((s, a) => s + (a.current_balance ?? 0), 0)
    const totalLiabilities = accounts.filter(a => a.kind === 'liability').reduce((s, a) => s + Math.abs(a.current_balance ?? 0), 0)
    const netWorth = totalAssets - totalLiabilities

    const monthlyIncome = transactions.filter(t => t.cr_dr === 'credit').reduce((s, t) => s + (t.amount_usd ?? 0), 0)
    const monthlyExpenses = transactions.filter(t => t.cr_dr === 'debit').reduce((s, t) => s + (t.amount_usd ?? 0), 0)
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100).toFixed(1) : '0.0'

    const spendByCategory: Record<string, number> = {}
    for (const t of transactions) {
      if (t.cr_dr === 'debit') {
        const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
        spendByCategory[cat] = (spendByCategory[cat] ?? 0) + (t.amount_usd ?? 0)
      }
    }
    const topCategories = Object.entries(spendByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)

    const budgetsWithActuals = rawBudgets.map(b => {
      const catName = (b.category as unknown as { name: string } | null)?.name ?? 'Unknown'
      return { category: catName, budget: b.amount_usd }
    })

    const activeSubs = subscriptions.filter(s => s.status === 'active')
    const monthlySubCost = activeSubs.reduce((s, sub) => s + sub.billing_cost / (sub.billing_cycle_months || 1), 0)

    const totalPortfolioValue = investments.reduce((s, i) => s + i.current_value, 0)
    const totalInvested = investments.reduce((s, i) => s + i.total_invested, 0)
    const portfolioGainLoss = totalPortfolioValue - totalInvested

    // Build compact context string for Claude
    const context = `
## Financial Snapshot — ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

### Net Worth
- Total Assets: ${fmt(totalAssets)}
- Total Liabilities: ${fmt(totalLiabilities)}
- Net Worth: ${fmt(netWorth)}

### This Month
- Income: ${fmt(monthlyIncome)}
- Expenses: ${fmt(monthlyExpenses)}
- Savings Rate: ${savingsRate}%

### Top Spending Categories
${topCategories.map(([cat, amt]) => `- ${cat}: ${fmt(amt)}`).join('\n') || '- No transactions this month'}

### Budgets
${budgetsWithActuals.map(b => `- ${b.category}: ${fmt(b.budget)} budget`).join('\n') || '- No budgets set'}

### Accounts (${accounts.length} active)
${accounts.map(a => `- ${a.name} (${a.type}): ${fmt(a.current_balance)}`).join('\n')}

### Loans
${loans.length === 0 ? '- No loans' : loans.map(l => {
  const monthlyInterest = (l.current_balance * l.interest_rate / 100) / 12
  const principalPaid = Math.max(l.emi - monthlyInterest, 1)
  const monthsLeft = Math.ceil(l.current_balance / principalPaid)
  const payoff = new Date(); payoff.setMonth(payoff.getMonth() + monthsLeft)
  return `- ${l.name}: ${fmt(l.current_balance)} remaining, ${l.interest_rate}% rate, ${fmt(l.emi)}/mo EMI, payoff ~${payoff.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}).join('\n')}

### Investments
${investments.length === 0 ? '- No investments' : `- Portfolio Value: ${fmt(totalPortfolioValue)} (${portfolioGainLoss >= 0 ? '+' : ''}${fmt(portfolioGainLoss)} gain/loss)\n` + investments.map(i => `  - ${i.ticker || i.type} on ${i.platform}: ${fmt(i.current_value)}`).join('\n')}

### Subscriptions
${activeSubs.length === 0 ? '- No active subscriptions' : `- Total: ${fmt(monthlySubCost)}/month\n` + activeSubs.map(s => `  - ${s.name}: ${fmt(s.billing_cost / (s.billing_cycle_months || 1))}/mo`).join('\n')}

### Savings Goals
${savingsGoals.length === 0 ? '- No savings goals' : savingsGoals.map(g => `- ${g.name}: ${fmt(g.current_amount)} / ${fmt(g.target_amount)} (${g.status})`).join('\n')}
`.trim()

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are FinanceOS, a personal finance assistant. You have access to the user's real financial data below. Answer questions concisely and helpfully using this data. Format numbers as currency when relevant. Be specific with the actual numbers. Keep answers under 200 words unless a detailed breakdown is explicitly requested.

${context}`,
      messages: [
        { role: 'user', content: question },
      ],
    })

    const answer = message.content[0].type === 'text' ? message.content[0].text : 'Sorry, I could not generate a response.'

    // Save insight
    await supabase.from('ai_insights').insert({
      user_id: user.id,
      type: 'daily',
      content: `Q: ${question}\n\nA: ${answer}`,
      is_read: false,
    })

    return NextResponse.json({ answer })
  } catch (err) {
    console.error('AI Chat error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
