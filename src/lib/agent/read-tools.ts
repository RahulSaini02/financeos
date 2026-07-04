// src/lib/agent/read-tools.ts
// Read-tool executors and the public executeReadTool dispatcher.
// All queries are scoped by user_id — never queries without user scope.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fmt, like, todayInTz, monthStartInTz, amortizedPayoff, DEFAULT_TZ } from './shared'
import type { ToolResult } from './shared'

async function execQuerySpending(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const startDate = input.start_date as string
  const endDate = input.end_date as string
  const category = typeof input.category === 'string' ? input.category : undefined
  const crDr = typeof input.cr_dr === 'string' ? (input.cr_dr as 'credit' | 'debit') : undefined
  const limit = typeof input.limit === 'number' ? Math.min(input.limit, 100) : 20

  // When filtering by category, use an inner join so the ilike applies server-side
  // (a plain embed would filter after the limit and silently drop matches)
  const embed = category ? 'category:categories!inner(name)' : 'category:categories(name)'

  let listQuery = supabase
    .from('transactions')
    .select(`description, amount_usd, cr_dr, date, ${embed}`)
    .eq('user_id', userId)
    .eq('is_internal_transfer', false)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .limit(limit)

  // Separate aggregate query with the same filters so totals reflect the full
  // range, not just the rows shown. The high limit is a wire-size safety cap.
  let totalsQuery = supabase
    .from('transactions')
    .select(`amount_usd, cr_dr, ${embed}`)
    .eq('user_id', userId)
    .eq('is_internal_transfer', false)
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(10000)

  if (crDr) {
    listQuery = listQuery.eq('cr_dr', crDr)
    totalsQuery = totalsQuery.eq('cr_dr', crDr)
  }
  if (category) {
    listQuery = listQuery.ilike('category.name', like(category))
    totalsQuery = totalsQuery.ilike('category.name', like(category))
  }

  const [{ data: rows, error }, { data: totalRows, error: totalsError }] = await Promise.all([
    listQuery,
    totalsQuery,
  ])

  if (error || totalsError) {
    const msg = error?.message ?? totalsError?.message ?? 'unknown error'
    return { text: `Error fetching transactions: ${msg}`, summary: 'Error fetching transactions' }
  }

  const transactions = rows ?? []
  const allInRange = totalRows ?? []

  const totalDebit = allInRange
    .filter((t) => t.cr_dr === 'debit')
    .reduce((s, t) => s + (t.amount_usd ?? 0), 0)
  const totalCredit = allInRange
    .filter((t) => t.cr_dr === 'credit')
    .reduce((s, t) => s + (t.amount_usd ?? 0), 0)

  const lines = [
    `Date range: ${startDate} to ${endDate}`,
    `Matching transactions: ${allInRange.length} (showing ${transactions.length} most recent)`,
    `Total Expenses (debit): ${fmt(totalDebit)}`,
    `Total Income (credit): ${fmt(totalCredit)}`,
    '',
    'Transactions:',
    ...transactions.map((t) => {
      const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
      const sign = t.cr_dr === 'debit' ? '-' : '+'
      return `  ${t.date} | ${sign}${fmt(t.amount_usd ?? 0)} | ${cat} | ${t.description}`
    }),
  ]

  const summary =
    `Found ${allInRange.length} transactions: ${fmt(totalDebit)} expenses, ${fmt(totalCredit)} income (${startDate} to ${endDate})`

  return { text: lines.join('\n'), summary }
}

async function execGetBudgetStatus(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string = DEFAULT_TZ,
): Promise<ToolResult> {
  const month = typeof input.month === 'string' ? input.month : monthStartInTz(tz)

  let budgetsRes = await supabase
    .from('budgets')
    .select('amount_usd, category_id, category:categories(name)')
    .eq('user_id', userId)
    .eq('month', month)

  // Fallback: if no budgets for the requested month, use the most recent month that has budgets
  let resolvedMonth = month
  if (!budgetsRes.data?.length) {
    const fallback = await supabase
      .from('budgets')
      .select('month')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(1)
      .single()
    if (fallback.data?.month) {
      resolvedMonth = fallback.data.month
      budgetsRes = await supabase
        .from('budgets')
        .select('amount_usd, category_id, category:categories(name)')
        .eq('user_id', userId)
        .eq('month', resolvedMonth)
    }
  }

  const transactionsRes = await supabase
    .from('transactions')
    .select('amount_usd, cr_dr, category_id')
    .eq('user_id', userId)
    .eq('is_internal_transfer', false)
    .gte('date', resolvedMonth)
    .lt(
      'date',
      (() => {
        const d = new Date(resolvedMonth)
        d.setMonth(d.getMonth() + 1)
        return d.toISOString().split('T')[0]
      })(),
    )
    .eq('cr_dr', 'debit')

  const budgets = budgetsRes.data ?? []
  const transactions = transactionsRes.data ?? []

  // Build spend by category_id
  const spendByCat: Record<string, number> = {}
  for (const t of transactions) {
    if (t.category_id) {
      spendByCat[t.category_id] = (spendByCat[t.category_id] ?? 0) + (t.amount_usd ?? 0)
    }
  }

  let overCount = 0
  const rows = budgets.map((b) => {
    const catName = (b.category as unknown as { name: string } | null)?.name ?? 'Unknown'
    const actual = spendByCat[b.category_id] ?? 0
    const remaining = b.amount_usd - actual
    const status = actual === 0 ? 'no_spend' : actual > b.amount_usd ? 'over_budget' : 'on_track'
    if (status === 'over_budget') overCount++
    return { catName, budget: b.amount_usd, actual, remaining, status }
  })

  const lines = [
    `Budget Status for ${resolvedMonth}${resolvedMonth !== month ? ` (most recent; no budgets found for ${month})` : ''}:`,
    `Total budget categories: ${rows.length}`,
    `Over budget: ${overCount}`,
    '',
    'Category | Budget | Actual | Remaining | Status',
    ...rows.map(
      (r) =>
        `  ${r.catName} | ${fmt(r.budget)} | ${fmt(r.actual)} | ${fmt(r.remaining)} | ${r.status}`,
    ),
  ]

  const summary = `${rows.length} budget categories, ${overCount} over budget (${resolvedMonth})`
  return { text: lines.join('\n'), summary }
}

async function execGetSavingsGoals(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const statusFilter = typeof input.status === 'string' ? input.status : 'active'

  let query = supabase
    .from('savings_goals')
    .select('id, name, icon, target_amount, current_amount, monthly_contribution, status, notes')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data: goals, error } = await query

  if (error) {
    return { text: `Error fetching savings goals: ${error.message}`, summary: 'Error fetching savings goals' }
  }

  const rows = goals ?? []
  const now = new Date()

  const lines = [
    `Savings Goals (${statusFilter}): ${rows.length} found`,
    '',
    ...rows.map((g) => {
      const progress = g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(1) : '0.0'
      const remaining = g.target_amount - g.current_amount
      let projectionStr = 'N/A'
      if (g.monthly_contribution > 0 && remaining > 0) {
        const monthsLeft = Math.ceil(remaining / g.monthly_contribution)
        const projDate = new Date(now)
        projDate.setMonth(projDate.getMonth() + monthsLeft)
        projectionStr = projDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      } else if (remaining <= 0) {
        projectionStr = 'Completed'
      }
      const icon = g.icon ? `${g.icon} ` : ''
      return [
        `  ${icon}${g.name} [${g.status}]`,
        `    Progress: ${fmt(g.current_amount)} / ${fmt(g.target_amount)} (${progress}%)`,
        `    Monthly Contribution: ${fmt(g.monthly_contribution)}`,
        `    Projected Completion: ${projectionStr}`,
        g.notes ? `    Notes: ${g.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    }),
  ]

  const summary = `${rows.length} savings goals (${statusFilter}) — total target: ${fmt(rows.reduce((s, g) => s + g.target_amount, 0))}`
  return { text: lines.join('\n'), summary }
}

async function execGetLoanDetails(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const query = supabase
    .from('loans')
    .select('id, name, type, current_balance, interest_rate, emi, start_date, term_months, principal')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const { data: loans, error } = await query

  if (error) {
    return { text: `Error fetching loans: ${error.message}`, summary: 'Error fetching loans' }
  }

  let rows = loans ?? []

  // Optional name filter
  const loanName = typeof input.loan_name === 'string' ? input.loan_name : undefined
  if (loanName) {
    rows = rows.filter((l) => l.name.toLowerCase().includes(loanName.toLowerCase()))
  }

  const now = new Date()
  const lines = [
    `Loans: ${rows.length} found`,
    '',
    ...rows.map((l) => {
      const payoff = amortizedPayoff(l.current_balance, l.interest_rate, l.emi)
      if (!payoff) {
        return [
          `  ${l.name} (${l.type})`,
          `    Current Balance: ${fmt(l.current_balance)}`,
          `    Interest Rate: ${l.interest_rate}%`,
          `    EMI: ${fmt(l.emi)}/month`,
          `    WARNING: EMI does not cover monthly interest — balance will grow at this payment level`,
        ].join('\n')
      }
      const payoffDate = new Date(now)
      payoffDate.setMonth(payoffDate.getMonth() + payoff.months)
      const payoffStr = payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      return [
        `  ${l.name} (${l.type})`,
        `    Current Balance: ${fmt(l.current_balance)}`,
        `    Interest Rate: ${l.interest_rate}%`,
        `    EMI: ${fmt(l.emi)}/month`,
        `    Months Remaining: ${payoff.months}`,
        `    Estimated Payoff: ${payoffStr}`,
        `    Estimated Remaining Interest: ${fmt(payoff.totalInterest)}`,
      ].join('\n')
    }),
  ]

  const totalBalance = rows.reduce((s, l) => s + l.current_balance, 0)
  const summary = `${rows.length} loan(s) — total balance: ${fmt(totalBalance)}`
  return { text: lines.join('\n'), summary }
}

async function execGetSubscriptionList(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const statusFilter = typeof input.status === 'string' ? input.status : 'active'

  let query = supabase
    .from('subscriptions')
    .select('id, name, billing_cost, billing_cycle_months, status, next_billing_date, notes')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data: subs, error } = await query

  if (error) {
    return { text: `Error fetching subscriptions: ${error.message}`, summary: 'Error fetching subscriptions' }
  }

  const rows = subs ?? []
  const totalMonthly = rows.reduce(
    (s, sub) => s + sub.billing_cost / (sub.billing_cycle_months || 1),
    0,
  )

  const lines = [
    `Subscriptions (${statusFilter}): ${rows.length} found`,
    `Total Monthly Cost: ${fmt(totalMonthly)}`,
    '',
    ...rows.map((s) => {
      const monthlyCost = s.billing_cost / (s.billing_cycle_months || 1)
      const cycleLabel =
        s.billing_cycle_months === 1
          ? 'monthly'
          : s.billing_cycle_months === 12
            ? 'annually'
            : `every ${s.billing_cycle_months} months`
      const nextBilling = s.next_billing_date ? ` — next: ${s.next_billing_date}` : ''
      return `  ${s.name} [${s.status}]: ${fmt(s.billing_cost)} ${cycleLabel} (${fmt(monthlyCost)}/mo)${nextBilling}`
    }),
  ]

  const summary = `${rows.length} subscriptions (${statusFilter}) — ${fmt(totalMonthly)}/month total`
  return { text: lines.join('\n'), summary }
}

async function execGetFinancialSummary(
  _input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string = DEFAULT_TZ,
): Promise<ToolResult> {
  const now = new Date()
  const todayStr = todayInTz(tz)

  const [todayYear, todayMonth] = todayStr.split('-').map(Number)
  const firstDay = `${todayYear}-${String(todayMonth).padStart(2, '0')}-01`
  const nextMonthNum = todayMonth === 12 ? 1 : todayMonth + 1
  const nextMonthYear = todayMonth === 12 ? todayYear + 1 : todayYear
  const nextMonth = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01`

  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const sevenDaysStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(sevenDaysFromNow)

  const [
    accountsRes,
    transactionsRes,
    loansRes,
    investmentsRes,
    subscriptionsRes,
    savingsGoalsRes,
    calendarEventsRes,
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('name, kind, type, current_balance, currency')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('transactions')
      .select('description, amount_usd, cr_dr, date, category:categories(name)')
      .eq('user_id', userId)
      .eq('is_internal_transfer', false)
      .gte('date', firstDay)
      .lt('date', nextMonth),
    supabase
      .from('loans')
      .select('name, type, current_balance, interest_rate, emi')
      .eq('user_id', userId),
    supabase
      .from('investments')
      .select('ticker, type, platform, total_invested, current_value')
      .eq('user_id', userId),
    supabase
      .from('subscriptions')
      .select('name, billing_cost, billing_cycle_months, status, next_billing_date')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('savings_goals')
      .select('name, target_amount, current_amount, monthly_contribution, status')
      .eq('user_id', userId),
    supabase
      .from('calendar_events')
      .select('title, start_date, estimated_cost, is_bill_reminder')
      .eq('user_id', userId)
      .gte('start_date', todayStr)
      .lte('start_date', sevenDaysStr)
      .order('start_date', { ascending: true }),
  ])

  const accounts = accountsRes.data ?? []
  const transactions = transactionsRes.data ?? []
  const loans = loansRes.data ?? []
  const investments = investmentsRes.data ?? []
  const subscriptions = subscriptionsRes.data ?? []
  const savingsGoals = savingsGoalsRes.data ?? []
  const calendarEvents = calendarEventsRes.data ?? []

  const totalAssets = accounts
    .filter((a) => a.kind === 'asset' || a.kind === 'investment')
    .reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalLiabilities = accounts
    .filter((a) => a.kind === 'liability')
    .reduce((s, a) => s + Math.abs(a.current_balance ?? 0), 0)
  const netWorth = totalAssets - totalLiabilities

  const monthlyIncome = transactions
    .filter((t) => t.cr_dr === 'credit')
    .reduce((s, t) => s + (t.amount_usd ?? 0), 0)
  const monthlyExpenses = transactions
    .filter((t) => t.cr_dr === 'debit')
    .reduce((s, t) => s + (t.amount_usd ?? 0), 0)
  const savingsRate =
    monthlyIncome > 0
      ? (((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100).toFixed(1)
      : '0.0'

  const spendByCategory: Record<string, number> = {}
  for (const t of transactions) {
    if (t.cr_dr === 'debit') {
      const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
      spendByCategory[cat] = (spendByCategory[cat] ?? 0) + (t.amount_usd ?? 0)
    }
  }
  const topCategories = Object.entries(spendByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const monthlySubCost = subscriptions.reduce(
    (s, sub) => s + sub.billing_cost / (sub.billing_cycle_months || 1),
    0,
  )

  const totalPortfolioValue = investments.reduce((s, i) => s + i.current_value, 0)
  const totalInvested = investments.reduce((s, i) => s + i.total_invested, 0)
  const portfolioGainLoss = totalPortfolioValue - totalInvested

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: tz })

  const lines = [
    `Financial Summary — ${monthLabel}`,
    '',
    '## Net Worth',
    `  Total Assets: ${fmt(totalAssets)}`,
    `  Total Liabilities: ${fmt(totalLiabilities)}`,
    `  Net Worth: ${fmt(netWorth)}`,
    '',
    '## This Month',
    `  Income: ${fmt(monthlyIncome)}`,
    `  Expenses: ${fmt(monthlyExpenses)}`,
    `  Savings Rate: ${savingsRate}%`,
    '',
    '## Top 5 Spending Categories',
    ...(topCategories.length > 0
      ? topCategories.map(([cat, amt]) => `  ${cat}: ${fmt(amt)}`)
      : ['  No transactions this month']),
    '',
    `## Accounts (${accounts.length} active)`,
    ...accounts.map((a) => `  ${a.name} (${a.kind}/${a.type}): ${fmt(a.current_balance ?? 0)}`),
    '',
    '## Loans',
    ...(loans.length === 0
      ? ['  No loans']
      : loans.map((l) => {
          const payoff = amortizedPayoff(l.current_balance, l.interest_rate, l.emi)
          if (!payoff) {
            return `  ${l.name}: ${fmt(l.current_balance)} balance, ${l.interest_rate}% rate, ${fmt(l.emi)}/mo — EMI does not cover interest`
          }
          const payoffDate = new Date()
          payoffDate.setMonth(payoffDate.getMonth() + payoff.months)
          const payoffStr = payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          return `  ${l.name}: ${fmt(l.current_balance)} balance, ${l.interest_rate}% rate, ${fmt(l.emi)}/mo, payoff ~${payoffStr}`
        })),
    '',
    '## Investments',
    ...(investments.length === 0
      ? ['  No investments']
      : [
          `  Portfolio Value: ${fmt(totalPortfolioValue)} (${portfolioGainLoss >= 0 ? '+' : ''}${fmt(portfolioGainLoss)} gain/loss)`,
          `  Total Invested: ${fmt(totalInvested)}`,
          ...investments.map((i) => `  ${i.ticker || i.type} on ${i.platform}: ${fmt(i.current_value)}`),
        ]),
    '',
    '## Subscriptions',
    ...(subscriptions.length === 0
      ? ['  No active subscriptions']
      : [
          `  Total Monthly Cost: ${fmt(monthlySubCost)}`,
          ...subscriptions.map(
            (s) => `  ${s.name}: ${fmt(s.billing_cost / (s.billing_cycle_months || 1))}/mo`,
          ),
        ]),
    '',
    '## Savings Goals',
    ...(savingsGoals.length === 0
      ? ['  No savings goals']
      : savingsGoals.map(
          (g) => `  ${g.name}: ${fmt(g.current_amount)} / ${fmt(g.target_amount)} (${g.status})`,
        )),
    '',
    '## Upcoming Calendar Events (next 7 days)',
    ...(calendarEvents.length === 0
      ? ['  No upcoming financial events']
      : calendarEvents.map((e) => {
          const costPart = e.estimated_cost ? ` - $${e.estimated_cost}` : ''
          const billPart = e.is_bill_reminder ? ' [bill reminder]' : ''
          return `  ${e.title} on ${e.start_date}${costPart}${billPart}`
        })),
  ]

  const summary = `Financial summary: net worth ${fmt(netWorth)}, ${fmt(monthlyIncome)} income, ${fmt(monthlyExpenses)} expenses (${monthLabel})`
  return { text: lines.join('\n'), summary }
}

async function execGetAccountBalances(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const kind = typeof input.kind === 'string' ? input.kind : 'all'

  let query = supabase
    .from('accounts')
    .select('name, kind, type, current_balance')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  if (kind !== 'all') {
    query = query.eq('kind', kind)
  }

  const { data: accounts, error } = await query

  if (error) {
    return { text: `Error fetching accounts: ${error.message}`, summary: 'Error fetching accounts' }
  }

  const rows = accounts ?? []
  const total = rows.reduce((s, a) => s + (a.current_balance ?? 0), 0)

  const lines = [
    `Accounts (${kind === 'all' ? 'all kinds' : kind}): ${rows.length} found`,
    `Total Balance: ${fmt(total)}`,
    '',
    ...rows.map((a) => `  ${a.name} (${a.kind}/${a.type}): ${fmt(a.current_balance ?? 0)}`),
  ]

  const summary = `${rows.length} accounts (${kind}), total balance: ${fmt(total)}`
  return { text: lines.join('\n'), summary }
}

async function execGetSpendingTrends(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string = DEFAULT_TZ,
): Promise<ToolResult> {
  const monthsBack = typeof input.months_back === 'number' ? Math.min(Math.max(input.months_back, 1), 12) : 3
  const categoryFilter = typeof input.category === 'string' ? input.category : undefined

  // Build start date: first day of (monthsBack) months ago, anchored to the
  // user's timezone so the current month matches what they see
  const [todayYear, todayMonth] = todayInTz(tz).split('-').map(Number)
  const startDate = new Date(todayYear, todayMonth - 1 - monthsBack + 1, 1)
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`

  const { data: rows, error } = await supabase
    .from('transactions')
    .select('amount_usd, cr_dr, date, category:categories(name)')
    .eq('user_id', userId)
    .eq('is_internal_transfer', false)
    .eq('cr_dr', 'debit')
    .gte('date', startStr)
    .order('date', { ascending: true })

  if (error) {
    return { text: `Error fetching trends: ${error.message}`, summary: 'Error fetching spending trends' }
  }

  const transactions = rows ?? []

  // Group by month → category → total
  const byMonth: Record<string, Record<string, number>> = {}

  for (const t of transactions) {
    const catName = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
    if (categoryFilter && !catName.toLowerCase().includes(categoryFilter.toLowerCase())) continue

    const month = t.date.slice(0, 7) // YYYY-MM
    if (!byMonth[month]) byMonth[month] = {}
    byMonth[month][catName] = (byMonth[month][catName] ?? 0) + Math.abs(t.amount_usd ?? 0)
  }

  const months = Object.keys(byMonth).sort()
  const grandTotal = months.reduce((s, m) => s + Object.values(byMonth[m]).reduce((a, b) => a + b, 0), 0)

  const lines: string[] = [
    `Spending Trends (last ${monthsBack} months${categoryFilter ? `, category: ${categoryFilter}` : ''}):`,
    '',
  ]

  for (const month of months) {
    // Mid-month anchor avoids the label rolling into the previous month when
    // "YYYY-MM-01" is parsed as UTC midnight in a behind-UTC server timezone
    const label = new Date(month + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const monthTotal = Object.values(byMonth[month]).reduce((a, b) => a + b, 0)
    lines.push(`${label} — Total: ${fmt(monthTotal)}`)
    const cats = Object.entries(byMonth[month]).sort((a, b) => b[1] - a[1])
    for (const [cat, amt] of cats) {
      lines.push(`  ${cat}: ${fmt(amt)}`)
    }
    lines.push('')
  }

  const summary = `Spending trends for ${monthsBack} months: ${fmt(grandTotal)} total across ${months.length} months`
  return { text: lines.join('\n'), summary }
}

async function execGetInvestments(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let query = supabase
    .from('investments')
    .select('ticker, type, platform, total_invested, current_value, last_updated, notes')
    .eq('user_id', userId)
    .order('current_value', { ascending: false })

  // Strip PostgREST or() syntax characters — commas/parens in user input would
  // break the filter expression
  const rawFilter = typeof input.ticker === 'string' ? input.ticker.replace(/[(),]/g, ' ').trim() : undefined
  const filter = rawFilter || undefined
  if (filter) {
    query = query.or(`ticker.ilike.${like(filter)},platform.ilike.${like(filter)}`)
  }

  const { data: rows, error } = await query
  if (error) {
    return { text: `Error fetching investments: ${error.message}`, summary: 'Error fetching investments' }
  }

  const investments = rows ?? []
  const totalValue = investments.reduce((s, i) => s + (i.current_value ?? 0), 0)
  const totalInvested = investments.reduce((s, i) => s + (i.total_invested ?? 0), 0)
  const gainLoss = totalValue - totalInvested
  const gainPct = totalInvested > 0 ? ((gainLoss / totalInvested) * 100).toFixed(1) : '0.0'

  const lines = [
    `Investments: ${investments.length} holdings${filter ? ` (filter: ${filter})` : ''}`,
    `Portfolio Value: ${fmt(totalValue)}`,
    `Total Invested: ${fmt(totalInvested)}`,
    `Gain/Loss: ${gainLoss >= 0 ? '+' : ''}${fmt(gainLoss)} (${gainPct}%)`,
    '',
    ...investments.map((i) => {
      const gl = (i.current_value ?? 0) - (i.total_invested ?? 0)
      return `  ${i.ticker || i.type} on ${i.platform}: ${fmt(i.current_value ?? 0)} (invested ${fmt(i.total_invested ?? 0)}, ${gl >= 0 ? '+' : ''}${fmt(gl)})`
    }),
  ]

  const summary = `${investments.length} holdings — ${fmt(totalValue)} value, ${gainLoss >= 0 ? '+' : ''}${fmt(gainLoss)} gain/loss`
  return { text: lines.join('\n'), summary }
}

async function execGetPaychecks(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string,
): Promise<ToolResult> {
  const today = todayInTz(tz)
  const defaultStart = (() => {
    const d = new Date(`${today}T12:00:00`)
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().split('T')[0]
  })()
  const startDate = typeof input.start_date === 'string' ? input.start_date : defaultStart
  const endDate = typeof input.end_date === 'string' ? input.end_date : today
  const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 10

  const { data: rows, error } = await supabase
    .from('paychecks')
    .select('employer, date, gross_pay, federal_tax, state_tax, sdi, other_deductions, retirement_401k, employer_401k_match, net_pay')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    return { text: `Error fetching paychecks: ${error.message}`, summary: 'Error fetching paychecks' }
  }

  const paychecks = rows ?? []
  const totalGross = paychecks.reduce((s, p) => s + (p.gross_pay ?? 0), 0)
  const totalNet = paychecks.reduce((s, p) => s + (p.net_pay ?? 0), 0)
  const total401k = paychecks.reduce((s, p) => s + (p.retirement_401k ?? 0), 0)
  const totalTax = paychecks.reduce((s, p) => s + (p.federal_tax ?? 0) + (p.state_tax ?? 0) + (p.sdi ?? 0), 0)

  const lines = [
    `Paychecks (${startDate} to ${endDate}): ${paychecks.length} found`,
    `Total Gross: ${fmt(totalGross)} | Total Net: ${fmt(totalNet)} | Taxes Withheld: ${fmt(totalTax)} | 401k: ${fmt(total401k)}`,
    '',
    ...paychecks.map((p) =>
      `  ${p.date} | ${p.employer} | gross ${fmt(p.gross_pay ?? 0)} → net ${fmt(p.net_pay ?? 0)} (fed ${fmt(p.federal_tax ?? 0)}, state ${fmt(p.state_tax ?? 0)}, 401k ${fmt(p.retirement_401k ?? 0)}${p.employer_401k_match ? ` + ${fmt(p.employer_401k_match)} match` : ''})`,
    ),
  ]

  const summary = `${paychecks.length} paychecks — ${fmt(totalGross)} gross, ${fmt(totalNet)} net (${startDate} to ${endDate})`
  return { text: lines.join('\n'), summary }
}

async function execGetRecurringRules(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const activeOnly = input.active_only !== false

  let query = supabase
    .from('recurring_rules')
    .select('description, amount_usd, cr_dr, frequency, next_due, is_active, category:categories(name)')
    .eq('user_id', userId)
    .order('next_due', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data: rows, error } = await query
  if (error) {
    return { text: `Error fetching recurring rules: ${error.message}`, summary: 'Error fetching recurring rules' }
  }

  const rules = rows ?? []
  const monthlyOut = rules
    .filter((r) => r.is_active && r.cr_dr === 'debit' && r.frequency === 'monthly')
    .reduce((s, r) => s + Math.abs(r.amount_usd ?? 0), 0)

  const lines = [
    `Recurring Rules (${activeOnly ? 'active' : 'all'}): ${rules.length} found`,
    `Monthly recurring outflow (monthly debit rules): ${fmt(monthlyOut)}`,
    '',
    ...rules.map((r) => {
      const cat = (r.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
      const sign = r.cr_dr === 'debit' ? '-' : '+'
      return `  ${r.description}: ${sign}${fmt(Math.abs(r.amount_usd ?? 0))} ${r.frequency} | next due ${r.next_due} | ${cat}${r.is_active ? '' : ' [inactive]'}`
    }),
  ]

  const summary = `${rules.length} recurring rules, ${fmt(monthlyOut)}/month recurring outflow`
  return { text: lines.join('\n'), summary }
}

async function execGetCategories(
  _input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const { data: rows, error } = await supabase
    .from('categories')
    .select('name, type, icon, monthly_budget')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return { text: `Error fetching categories: ${error.message}`, summary: 'Error fetching categories' }
  }

  const categories = rows ?? []
  const byType: Record<string, string[]> = {}
  for (const c of categories) {
    const label = `${c.icon ? `${c.icon} ` : ''}${c.name}${c.monthly_budget ? ` (budget ${fmt(c.monthly_budget)}/mo)` : ''}`
    if (!byType[c.type]) byType[c.type] = []
    byType[c.type].push(label)
  }

  const lines = [`Categories: ${categories.length} total`, '']
  for (const [type, items] of Object.entries(byType)) {
    lines.push(`${type}:`)
    for (const item of items) lines.push(`  ${item}`)
    lines.push('')
  }

  const summary = `${categories.length} categories across ${Object.keys(byType).length} types`
  return { text: lines.join('\n'), summary }
}

async function execGetNetworthHistory(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const monthsBack = typeof input.months_back === 'number' ? Math.min(Math.max(input.months_back, 1), 36) : 12

  const { data: rows, error } = await supabase
    .from('networth_snapshots')
    .select('month, assets_total, liabilities_total, net_worth')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(monthsBack)

  if (error) {
    return { text: `Error fetching net worth history: ${error.message}`, summary: 'Error fetching net worth history' }
  }

  const snapshots = (rows ?? []).reverse() // chronological
  if (snapshots.length === 0) {
    return {
      text: 'No net worth snapshots recorded yet. Snapshots are captured monthly by the app.',
      summary: 'No net worth history available',
    }
  }

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const change = last.net_worth - first.net_worth

  const lines = [
    `Net Worth History (last ${snapshots.length} snapshots):`,
    `Change over period: ${change >= 0 ? '+' : ''}${fmt(change)}`,
    '',
    'Month | Assets | Liabilities | Net Worth',
    ...snapshots.map(
      (s) => `  ${String(s.month).slice(0, 7)} | ${fmt(s.assets_total)} | ${fmt(s.liabilities_total)} | ${fmt(s.net_worth)}`,
    ),
  ]

  const summary = `${snapshots.length} snapshots — net worth ${change >= 0 ? 'up' : 'down'} ${fmt(Math.abs(change))} over the period`
  return { text: lines.join('\n'), summary }
}

async function execSearchTransactions(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const searchText = typeof input.query === 'string' ? input.query : ''
  if (!searchText.trim()) {
    return { text: 'A non-empty query is required.', summary: 'Empty search query' }
  }
  const limit = typeof input.limit === 'number' ? Math.min(input.limit, 25) : 10
  const accountName = typeof input.account_name === 'string' && input.account_name.trim() ? input.account_name.trim() : undefined

  // Account filter must be an inner-join ilike so it applies BEFORE the limit —
  // filtering after the limit can drop matches that exist past the first N rows
  const accountEmbed = accountName ? 'account:accounts!inner(name)' : 'account:accounts(name)'

  let query = supabase
    .from('transactions')
    .select(`id, description, amount_usd, cr_dr, date, flagged, ${accountEmbed}, category:categories(name)`)
    .eq('user_id', userId)
    .ilike('description', like(searchText))
    .order('date', { ascending: false })
    .limit(limit)

  if (accountName) query = query.ilike('account.name', like(accountName))
  if (typeof input.start_date === 'string') query = query.gte('date', input.start_date)
  if (typeof input.end_date === 'string') query = query.lte('date', input.end_date)

  const { data: rows, error } = await query
  if (error) {
    return { text: `Error searching transactions: ${error.message}`, summary: 'Error searching transactions' }
  }

  const transactions = rows ?? []

  const lines = [
    `Transactions matching "${searchText}": ${transactions.length} found`,
    '',
    ...transactions.map((t) => {
      const acct = (t.account as unknown as { name: string } | null)?.name ?? 'Unknown account'
      const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
      const sign = t.cr_dr === 'debit' ? '-' : '+'
      return `  id=${t.id} | ${t.date} | ${sign}${fmt(Math.abs(t.amount_usd ?? 0))} | ${t.description} | ${acct} | ${cat}${t.flagged ? ' [flagged]' : ''}`
    }),
  ]

  const summary = `Found ${transactions.length} transactions matching "${searchText}"`
  return { text: lines.join('\n'), summary }
}

export async function executeReadTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string = DEFAULT_TZ,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_financial_summary':
        return await execGetFinancialSummary(input, userId, supabase, tz)
      case 'get_account_balances':
        return await execGetAccountBalances(input, userId, supabase)
      case 'get_spending_trends':
        return await execGetSpendingTrends(input, userId, supabase, tz)
      case 'query_spending':
        return await execQuerySpending(input, userId, supabase)
      case 'get_budget_status':
        return await execGetBudgetStatus(input, userId, supabase, tz)
      case 'get_savings_goals':
        return await execGetSavingsGoals(input, userId, supabase)
      case 'get_loan_details':
        return await execGetLoanDetails(input, userId, supabase)
      case 'get_subscription_list':
        return await execGetSubscriptionList(input, userId, supabase)
      case 'get_investments':
        return await execGetInvestments(input, userId, supabase)
      case 'get_paychecks':
        return await execGetPaychecks(input, userId, supabase, tz)
      case 'get_recurring_rules':
        return await execGetRecurringRules(input, userId, supabase)
      case 'get_categories':
        return await execGetCategories(input, userId, supabase)
      case 'get_networth_history':
        return await execGetNetworthHistory(input, userId, supabase)
      case 'search_transactions':
        return await execSearchTransactions(input, userId, supabase)
      default:
        return { text: 'Unknown tool', summary: 'Unknown tool' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { text: `Error executing ${name}: ${msg}`, summary: `Failed: ${msg}` }
  }
}
