// src/lib/agent-tools.ts
// Central tool registry for the FinanceOS agentic AI.
// All queries are scoped by user_id — never queries without user scope.

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatCurrency } from '@/lib/utils'

const fmt = (n: number) => formatCurrency(n)

// ── Tool definitions ────────────────────────────────────────────────────────

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_spending_trends',
    description:
      'Returns month-by-month spending broken down by category for the past N months. Use when the user asks about trends, patterns, or how their spending has changed over time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        months_back: {
          type: 'number',
          description: 'How many months of history to return (1–12). Default: 3.',
        },
        category: {
          type: 'string',
          description: 'Optional category name filter (partial match, case-insensitive)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_spending',
    description:
      "Query the user's transactions for a date range. Returns total spend/income, transaction count, and individual transactions. Use whenever the user asks about spending in any time period.",
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        category: {
          type: 'string',
          description: 'Optional category name filter (partial match, case-insensitive)',
        },
        cr_dr: {
          type: 'string',
          enum: ['credit', 'debit'],
          description: 'credit=income, debit=expense. Omit for both.',
        },
        limit: {
          type: 'number',
          description: 'Max transactions to return. Default 20, max 100.',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_budget_status',
    description:
      'Returns all budget categories for a given month with actual spend, budget amount, remaining, and over/under status. Use when the user asks if they are on track or over budget.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: {
          type: 'string',
          description: 'Month as YYYY-MM-01. Defaults to current month if omitted.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_savings_goals',
    description:
      'Returns all savings goals with current progress, target amount, monthly contribution, and projected completion date. Use when the user asks about savings goals or financial targets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'all'],
          description: 'Filter by status. Default: active',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_loan_details',
    description:
      'Returns detailed loan information: current balance, interest rate, EMI, months remaining, and payoff date projection. Use when the user asks about debt payoff, loan progress, or interest costs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        loan_name: {
          type: 'string',
          description: 'Optional partial name match to filter a specific loan',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_subscription_list',
    description:
      'Returns subscriptions with billing cost, cycle, next billing date, and total monthly cost. Use when the user asks about recurring charges or subscriptions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'cancelled', 'all'],
          description: 'Filter by status. Default: active',
        },
      },
      required: [],
    },
  },
]

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_transaction',
    description:
      'Log a manual transaction to the user\'s account. ALWAYS present the details (account, amount, description, date) and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        account_name: { type: 'string', description: 'Partial account name to look up (e.g. "Chase Checking")' },
        description: { type: 'string', description: 'Transaction description / merchant name' },
        amount_usd: { type: 'number', description: 'Positive amount in USD' },
        cr_dr: {
          type: 'string',
          enum: ['credit', 'debit'],
          description: 'credit=income/deposit, debit=expense/payment',
        },
        date: { type: 'string', description: 'Transaction date YYYY-MM-DD. Defaults to today.' },
        category_name: { type: 'string', description: 'Optional category name (partial match)' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['account_name', 'description', 'amount_usd', 'cr_dr'],
    },
  },
  {
    name: 'flag_transaction',
    description:
      'Flag or unflag a transaction with an optional reason. ALWAYS confirm with the user before calling. Use when the user wants to mark a transaction as suspicious, incorrect, or worth revisiting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'Partial description to search for the transaction' },
        date: { type: 'string', description: 'Optional transaction date YYYY-MM-DD to narrow the search' },
        flagged: { type: 'boolean', description: 'true to flag, false to unflag' },
        reason: { type: 'string', description: 'Optional reason for flagging' },
      },
      required: ['description', 'flagged'],
    },
  },
  {
    name: 'update_budget',
    description:
      'Set or update a monthly budget amount for a specific category. ALWAYS present the details and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category_name: { type: 'string', description: 'The category name to update budget for' },
        amount_usd: { type: 'number', description: 'New monthly budget amount in USD' },
        month: { type: 'string', description: 'Month as YYYY-MM-01. Defaults to current month.' },
      },
      required: ['category_name', 'amount_usd'],
    },
  },
  {
    name: 'create_savings_goal',
    description:
      'Create a new savings goal. ALWAYS present the details and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Goal name, e.g. Emergency Fund' },
        target_amount: { type: 'number', description: 'Target amount in USD' },
        monthly_contribution: {
          type: 'number',
          description: 'Planned monthly contribution in USD. Default 0.',
        },
        current_amount: { type: 'number', description: 'Current saved amount. Default 0.' },
        icon: { type: 'string', description: 'Optional emoji icon' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['name', 'target_amount'],
    },
  },
]

export const WRITE_TOOL_NAMES: string[] = WRITE_TOOLS.map((t) => t.name)

// ── Tool result shape ───────────────────────────────────────────────────────

interface ToolResult {
  text: string
  summary: string
}

// ── Read tool executors ─────────────────────────────────────────────────────

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

  let query = supabase
    .from('transactions')
    .select('description, amount_usd, cr_dr, date, category:categories(name)')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .limit(limit)

  if (crDr) {
    query = query.eq('cr_dr', crDr)
  }

  if (category) {
    // We need to join via category name — filter post-fetch since Supabase doesn't support
    // ilike on foreign key joined columns in a simple select
  }

  const { data: rows, error } = await query

  if (error) {
    return { text: `Error fetching transactions: ${error.message}`, summary: 'Error fetching transactions' }
  }

  const transactions = rows ?? []

  // Filter by category name if provided (post-fetch)
  const filtered = category
    ? transactions.filter((t) => {
        const cat = (t.category as unknown as { name: string } | null)?.name ?? ''
        return cat.toLowerCase().includes(category.toLowerCase())
      })
    : transactions

  const totalDebit = filtered
    .filter((t) => t.cr_dr === 'debit')
    .reduce((s, t) => s + (t.amount_usd ?? 0), 0)
  const totalCredit = filtered
    .filter((t) => t.cr_dr === 'credit')
    .reduce((s, t) => s + (t.amount_usd ?? 0), 0)

  const lines = [
    `Date range: ${startDate} to ${endDate}`,
    `Transactions: ${filtered.length}`,
    `Total Expenses (debit): ${fmt(totalDebit)}`,
    `Total Income (credit): ${fmt(totalCredit)}`,
    '',
    'Transactions:',
    ...filtered.map((t) => {
      const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
      const sign = t.cr_dr === 'debit' ? '-' : '+'
      return `  ${t.date} | ${sign}${fmt(t.amount_usd ?? 0)} | ${cat} | ${t.description}`
    }),
  ]

  const summary =
    `Found ${filtered.length} transactions: ${fmt(totalDebit)} expenses, ${fmt(totalCredit)} income (${startDate} to ${endDate})`

  return { text: lines.join('\n'), summary }
}

async function execGetBudgetStatus(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  // Default to current month
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const month = typeof input.month === 'string' ? input.month : defaultMonth

  const [budgetsRes, transactionsRes] = await Promise.all([
    supabase
      .from('budgets')
      .select('amount_usd, category_id, category:categories(name)')
      .eq('user_id', userId)
      .eq('month', month),
    supabase
      .from('transactions')
      .select('amount_usd, cr_dr, category_id')
      .eq('user_id', userId)
      .gte('date', month)
      .lt(
        'date',
        (() => {
          const d = new Date(month)
          d.setMonth(d.getMonth() + 1)
          return d.toISOString().split('T')[0]
        })(),
      )
      .eq('cr_dr', 'debit'),
  ])

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
    `Budget Status for ${month}:`,
    `Total budget categories: ${rows.length}`,
    `Over budget: ${overCount}`,
    '',
    'Category | Budget | Actual | Remaining | Status',
    ...rows.map(
      (r) =>
        `  ${r.catName} | ${fmt(r.budget)} | ${fmt(r.actual)} | ${fmt(r.remaining)} | ${r.status}`,
    ),
  ]

  const summary = `${rows.length} budget categories, ${overCount} over budget (${month})`
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
      const monthlyInterest = (l.current_balance * l.interest_rate) / 100 / 12
      const principalPaid = Math.max(l.emi - monthlyInterest, 1)
      const monthsLeft = Math.ceil(l.current_balance / principalPaid)
      const payoffDate = new Date(now)
      payoffDate.setMonth(payoffDate.getMonth() + monthsLeft)
      const payoffStr = payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const totalInterest = monthlyInterest * monthsLeft

      return [
        `  ${l.name} (${l.type})`,
        `    Current Balance: ${fmt(l.current_balance)}`,
        `    Interest Rate: ${l.interest_rate}%`,
        `    EMI: ${fmt(l.emi)}/month`,
        `    Months Remaining: ${monthsLeft}`,
        `    Estimated Payoff: ${payoffStr}`,
        `    Estimated Remaining Interest: ${fmt(totalInterest)}`,
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

// ── Phase 2 read tool executor ──────────────────────────────────────────────

async function execGetSpendingTrends(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const monthsBack = typeof input.months_back === 'number' ? Math.min(Math.max(input.months_back, 1), 12) : 3
  const categoryFilter = typeof input.category === 'string' ? input.category : undefined

  // Build start date: first day of (monthsBack) months ago
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1)
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`

  const { data: rows, error } = await supabase
    .from('transactions')
    .select('amount_usd, cr_dr, date, category:categories(name)')
    .eq('user_id', userId)
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

// ── Write tool executors ────────────────────────────────────────────────────

async function execCreateTransaction(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const accountName = input.account_name as string
  const description = input.description as string
  const amountUsd = input.amount_usd as number
  const crDr = input.cr_dr as 'credit' | 'debit'
  const notes = typeof input.notes === 'string' ? input.notes : null

  // Default date to today (LA timezone)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const date = typeof input.date === 'string' ? input.date : todayStr

  // Look up account by name
  const { data: accountRow, error: acctError } = await supabase
    .from('accounts')
    .select('id, name, current_balance')
    .eq('user_id', userId)
    .ilike('name', `%${accountName}%`)
    .limit(1)
    .maybeSingle()

  if (acctError || !accountRow) {
    return {
      text: `Account "${accountName}" not found. Please check the account name and try again.`,
      summary: `Failed: account "${accountName}" not found`,
    }
  }

  // Optional: look up category by name
  let categoryId: string | null = null
  if (typeof input.category_name === 'string' && input.category_name.trim().length > 0) {
    const { data: catRow } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', `%${input.category_name}%`)
      .limit(1)
      .maybeSingle()
    categoryId = catRow?.id ?? null
  }

  // Signed amount: positive for credit, negative for debit
  const signedAmount = crDr === 'credit' ? Math.abs(amountUsd) : -Math.abs(amountUsd)

  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: accountRow.id,
      category_id: categoryId,
      description,
      amount_usd: signedAmount,
      final_amount: signedAmount,
      amount_original: Math.abs(amountUsd),
      original_currency: 'USD',
      cr_dr: crDr,
      date,
      notes,
      source: 'manual',
      import_status: 'confirmed',
      flagged: false,
      is_recurring: false,
      ai_categorized: false,
      is_internal_transfer: false,
    })
    .select('id')
    .single()

  if (txnError || !txn) {
    return {
      text: `Error creating transaction: ${txnError?.message ?? 'unknown error'}`,
      summary: `Failed: ${txnError?.message ?? 'unknown error'}`,
    }
  }

  // Atomically update account balance
  await supabase.rpc('increment_account_balance', {
    p_account_id: accountRow.id,
    p_amount: signedAmount,
  })

  const sign = crDr === 'credit' ? '+' : '-'
  const text = [
    `Transaction created successfully.`,
    `ID: ${txn.id}`,
    `Account: ${accountRow.name}`,
    `Description: ${description}`,
    `Amount: ${sign}${fmt(Math.abs(amountUsd))} (${crDr})`,
    `Date: ${date}`,
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n')

  const summary = `Created transaction: ${description} ${sign}${fmt(Math.abs(amountUsd))} on ${accountRow.name}`
  return { text, summary }
}

async function execFlagTransaction(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const descriptionSearch = input.description as string
  const flagged = input.flagged as boolean
  const reason = typeof input.reason === 'string' ? input.reason : null
  const dateFilter = typeof input.date === 'string' ? input.date : undefined

  // Find transaction by description
  let query = supabase
    .from('transactions')
    .select('id, description, amount_usd, cr_dr, date')
    .eq('user_id', userId)
    .ilike('description', `%${descriptionSearch}%`)
    .order('date', { ascending: false })
    .limit(1)

  if (dateFilter) {
    query = query.eq('date', dateFilter)
  }

  const { data: txn, error: findError } = await query.maybeSingle()

  if (findError || !txn) {
    return {
      text: `No transaction found matching "${descriptionSearch}"${dateFilter ? ` on ${dateFilter}` : ''}. Please be more specific.`,
      summary: `Failed: transaction "${descriptionSearch}" not found`,
    }
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ flagged, flagged_reason: flagged ? reason : null })
    .eq('id', txn.id)
    .eq('user_id', userId)

  if (updateError) {
    return {
      text: `Error updating transaction: ${updateError.message}`,
      summary: `Failed: ${updateError.message}`,
    }
  }

  const action = flagged ? 'Flagged' : 'Unflagged'
  const sign = txn.cr_dr === 'credit' ? '+' : '-'
  const text = [
    `Transaction ${action.toLowerCase()} successfully.`,
    `Description: ${txn.description}`,
    `Amount: ${sign}${fmt(Math.abs(txn.amount_usd ?? 0))}`,
    `Date: ${txn.date}`,
    flagged && reason ? `Reason: ${reason}` : '',
  ].filter(Boolean).join('\n')

  const summary = `${action} transaction: ${txn.description} (${txn.date})`
  return { text, summary }
}

async function execUpdateBudget(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const categoryName = input.category_name as string
  const amountUsd = input.amount_usd as number

  // Default to current month
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const month = typeof input.month === 'string' ? input.month : defaultMonth

  // Find category by name (ilike, scoped to user)
  const { data: categoryRow, error: catError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', `%${categoryName}%`)
    .maybeSingle()

  if (catError || !categoryRow) {
    const msg = `Category "${categoryName}" not found. Please check the category name and try again.`
    return { text: msg, summary: `Failed: category "${categoryName}" not found` }
  }

  const { error: upsertError } = await supabase.from('budgets').upsert(
    {
      user_id: userId,
      category_id: categoryRow.id,
      month,
      amount_usd: amountUsd,
    },
    { onConflict: 'user_id,category_id,month' },
  )

  if (upsertError) {
    return {
      text: `Error updating budget: ${upsertError.message}`,
      summary: `Failed: ${upsertError.message}`,
    }
  }

  const monthLabel = new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const text = `Budget updated successfully.\nCategory: ${categoryRow.name}\nNew Amount: ${fmt(amountUsd)}\nMonth: ${monthLabel}`
  const summary = `Updated ${categoryRow.name} budget to ${fmt(amountUsd)} for ${monthLabel}`
  return { text, summary }
}

async function execCreateSavingsGoal(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const name = input.name as string
  const targetAmount = input.target_amount as number
  const monthlyContribution = typeof input.monthly_contribution === 'number' ? input.monthly_contribution : 0
  const currentAmount = typeof input.current_amount === 'number' ? input.current_amount : 0
  const icon = typeof input.icon === 'string' ? input.icon : null
  const notes = typeof input.notes === 'string' ? input.notes : null

  const { data: newGoal, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: userId,
      name,
      target_amount: targetAmount,
      monthly_contribution: monthlyContribution,
      current_amount: currentAmount,
      status: 'active',
      icon,
      notes,
    })
    .select('id, name')
    .single()

  if (error) {
    return {
      text: `Error creating savings goal: ${error.message}`,
      summary: `Failed: ${error.message}`,
    }
  }

  const text = [
    `Savings goal created successfully.`,
    `ID: ${newGoal.id}`,
    `Name: ${name}`,
    `Target: ${fmt(targetAmount)}`,
    `Starting Amount: ${fmt(currentAmount)}`,
    `Monthly Contribution: ${fmt(monthlyContribution)}`,
    icon ? `Icon: ${icon}` : '',
    notes ? `Notes: ${notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const summary = `Created savings goal: ${name} (${fmt(targetAmount)} target)`
  return { text, summary }
}

// ── Public executor functions ───────────────────────────────────────────────

export async function executeReadTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  switch (name) {
    case 'get_spending_trends':
      return execGetSpendingTrends(input, userId, supabase)
    case 'query_spending':
      return execQuerySpending(input, userId, supabase)
    case 'get_budget_status':
      return execGetBudgetStatus(input, userId, supabase)
    case 'get_savings_goals':
      return execGetSavingsGoals(input, userId, supabase)
    case 'get_loan_details':
      return execGetLoanDetails(input, userId, supabase)
    case 'get_subscription_list':
      return execGetSubscriptionList(input, userId, supabase)
    default:
      return { text: 'Unknown tool', summary: 'Unknown tool' }
  }
}

export async function executeWriteTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'create_transaction':
        return await execCreateTransaction(input, userId, supabase)
      case 'flag_transaction':
        return await execFlagTransaction(input, userId, supabase)
      case 'update_budget':
        return await execUpdateBudget(input, userId, supabase)
      case 'create_savings_goal':
        return await execCreateSavingsGoal(input, userId, supabase)
      default:
        return { text: 'Unknown write tool', summary: 'Unknown write tool' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { text: `Error executing ${name}: ${msg}`, summary: `Failed: ${msg}` }
  }
}
