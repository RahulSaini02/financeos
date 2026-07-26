// src/lib/agent/write-tools.ts
// Write-tool executors and the public executeWriteTool dispatcher.
// All queries are scoped by user_id — never queries without user scope.

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getFxRate, convertAmount } from '@/lib/fx'
import type { CurrencyCode } from '@/lib/types'
import { fmt, like, todayInTz, monthStartInTz, DEFAULT_TZ } from './shared'
import type { ToolResult } from './shared'

// Re-verifies an account belongs to this user before SECURITY DEFINER RPC calls.
// Defense-in-depth: resolution already scopes by user_id, but increment_account_balance
// bypasses RLS. We must own the account before touching its balance.
async function verifyAccountOwned(
  accountId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ id: string; name: string; currency: string } | null> {
  const { data } = await supabase
    .from('accounts')
    .select('id, name, currency')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

// Validates that resolved input contains required typed fields for a write tool.
// Called at the top of executeWriteTool before any DB access.
function validateWriteInput(name: string, input: Record<string, unknown>): string | null {
  const required: Record<string, Array<[string, string]>> = {
    transfer_funds: [['source_account_id', 'string'], ['target_account_id', 'string'], ['amount', 'number']],
    delete_transaction: [['transaction_id', 'string']],
    log_loan_payment: [['loan_id', 'string'], ['new_loan_balance', 'number'], ['payment_amount', 'number'], ['date', 'string']],
    create_account: [['name', 'string'], ['type', 'string'], ['kind', 'string']],
    create_subscription: [['name', 'string'], ['billing_cost', 'number']],
    delete_subscription: [['subscription_id', 'string']],
    log_subscription_payment: [['subscription_id', 'string'], ['next_billing_date', 'string']],
    delete_savings_goal: [['goal_id', 'string']],
    create_investment: [['ticker', 'string'], ['type', 'string'], ['platform', 'string'], ['total_invested', 'number'], ['current_value', 'number']],
    update_investment: [['investment_id', 'string']],
    delete_investment: [['investment_id', 'string']],
    create_paycheck: [['employer', 'string'], ['date', 'string'], ['gross_pay', 'number'], ['net_pay', 'number']],
    create_recurring_rule: [['account_id', 'string'], ['description', 'string'], ['amount_usd', 'number'], ['cr_dr', 'string'], ['frequency', 'string'], ['next_due', 'string']],
    update_recurring_rule: [['rule_id', 'string']],
    delete_recurring_rule: [['rule_id', 'string']],
  }
  const fields = required[name]
  if (!fields) return null
  for (const [field, type] of fields) {
    const val = input[field]
    if (type === 'string' && typeof val !== 'string') return `Missing required field: ${field}`
    if (type === 'number' && typeof val !== 'number') return `Missing required field: ${field}`
  }
  return null
}

async function execCreateTransaction(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string,
): Promise<ToolResult> {
  const accountName = input.account_name as string
  const description = input.description as string
  const amountUsd = input.amount_usd as number
  const crDr = input.cr_dr as 'credit' | 'debit'
  const notes = typeof input.notes === 'string' ? input.notes : null

  const date = typeof input.date === 'string' ? input.date : todayInTz(tz)

  // Prefer the account resolved at confirmation time; fall back to name lookup
  // for legacy pending actions that predate resolution
  let accountRow: { id: string; name: string; currency: string } | null = null
  if (typeof input.account_id === 'string') {
    const { data } = await supabase
      .from('accounts')
      .select('id, name, currency')
      .eq('user_id', userId)
      .eq('id', input.account_id)
      .maybeSingle()
    accountRow = data
  } else {
    const { data } = await supabase
      .from('accounts')
      .select('id, name, currency')
      .eq('user_id', userId)
      .ilike('name', like(accountName))
      .limit(1)
      .maybeSingle()
    accountRow = data
  }

  if (!accountRow) {
    return {
      text: `Account "${accountName}" not found. Please check the account name and try again.`,
      summary: `Failed: account "${accountName}" not found`,
    }
  }

  // Compute USD-normalized amount for storage; keep native amount for balance delta
  const accountCurrency: CurrencyCode = (accountRow.currency as CurrencyCode | null) ?? 'USD'
  const fxRate = accountCurrency !== 'USD' ? await getFxRate(accountCurrency, 'USD') : 1
  const usdNormalized = convertAmount(Math.abs(amountUsd), fxRate)

  // Optional category: prefer resolved id, fall back to name lookup
  let categoryId: string | null = null
  if (typeof input.category_id === 'string') {
    categoryId = input.category_id
  } else if (typeof input.category_name === 'string' && input.category_name.trim().length > 0) {
    const { data: catRow } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', like(input.category_name))
      .limit(1)
      .maybeSingle()
    categoryId = catRow?.id ?? null
  }

  // Signed amounts: native (for balance delta) and USD-normalized (for DB storage)
  const signedAmount = crDr === 'credit' ? Math.abs(amountUsd) : -Math.abs(amountUsd)
  const signedAmountUsd = crDr === 'credit' ? usdNormalized : -usdNormalized

  const { data: txn, error: txnError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: accountRow.id,
      category_id: categoryId,
      description,
      amount_usd: signedAmountUsd,
      final_amount: signedAmountUsd,
      amount_original: Math.abs(amountUsd),
      original_currency: accountCurrency,
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

  // Atomically update account balance (function defined in migration 010/011)
  const { error: balErr } = await supabase.rpc('increment_account_balance', {
    p_account_id: accountRow.id,
    p_delta: signedAmount,
  })
  if (balErr) console.error('increment_account_balance error:', balErr)

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
  const descriptionSearch = typeof input.description === 'string' ? input.description : ''
  const flagged = input.flagged as boolean
  const reason = typeof input.reason === 'string' ? input.reason : null
  const dateFilter = typeof input.date === 'string' ? input.date : undefined

  // Prefer the transaction resolved at confirmation time
  let txn: { id: string; description: string; amount_usd: number; cr_dr: string; date: string } | null = null
  if (typeof input.transaction_id === 'string') {
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount_usd, cr_dr, date')
      .eq('user_id', userId)
      .eq('id', input.transaction_id)
      .maybeSingle()
    txn = data
  } else {
    let query = supabase
      .from('transactions')
      .select('id, description, amount_usd, cr_dr, date')
      .eq('user_id', userId)
      .ilike('description', like(descriptionSearch))
      .order('date', { ascending: false })
      .limit(1)
    if (dateFilter) query = query.eq('date', dateFilter)
    const { data } = await query.maybeSingle()
    txn = data
  }

  if (!txn) {
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
  tz: string,
): Promise<ToolResult> {
  const categoryName = input.category_name as string
  const amountUsd = input.amount_usd as number
  const month = typeof input.month === 'string' ? input.month : monthStartInTz(tz)

  // Prefer the category resolved at confirmation time; fall back to name lookup
  let categoryRow: { id: string; name: string } | null = null
  if (typeof input.category_id === 'string') {
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('id', input.category_id)
      .maybeSingle()
    categoryRow = data
  } else {
    const { data: candidates } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', like(categoryName))
      .limit(5)
    const rows = candidates ?? []
    // Prefer an exact (case-insensitive) match when several categories share the substring
    categoryRow =
      rows.length === 1
        ? rows[0]
        : rows.find((r) => r.name.toLowerCase() === categoryName.toLowerCase()) ?? null
    if (!categoryRow && rows.length > 1) {
      const names = rows.map((r) => `"${r.name}"`).join(', ')
      return {
        text: `Multiple categories match "${categoryName}": ${names}. Please specify which one.`,
        summary: `Failed: ambiguous category "${categoryName}"`,
      }
    }
  }

  if (!categoryRow) {
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

async function execUpdateTransaction(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const descriptionSearch = typeof input.description === 'string' ? input.description : ''
  const dateFilter = typeof input.date === 'string' ? input.date : undefined

  let txn: { id: string; description: string; amount_usd: number; cr_dr: string; date: string } | null = null
  if (typeof input.transaction_id === 'string') {
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount_usd, cr_dr, date')
      .eq('user_id', userId)
      .eq('id', input.transaction_id)
      .maybeSingle()
    txn = data
  } else if (descriptionSearch) {
    let query = supabase
      .from('transactions')
      .select('id, description, amount_usd, cr_dr, date')
      .eq('user_id', userId)
      .ilike('description', like(descriptionSearch))
      .order('date', { ascending: false })
      .limit(1)
    if (dateFilter) query = query.eq('date', dateFilter)
    const { data } = await query.maybeSingle()
    txn = data
  }

  if (!txn) {
    return {
      text: `No transaction found${descriptionSearch ? ` matching "${descriptionSearch}"` : ''}. Use search_transactions to find it first.`,
      summary: 'Failed: transaction not found',
    }
  }

  const updates: Record<string, unknown> = {}
  const changeParts: string[] = []

  if (typeof input.category_id === 'string') {
    updates.category_id = input.category_id
    changeParts.push(`category → ${typeof input.category_display === 'string' ? input.category_display : 'new category'}`)
  } else if (typeof input.new_category_name === 'string' && input.new_category_name.trim()) {
    const { data: catRow } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', like(input.new_category_name))
      .limit(1)
      .maybeSingle()
    if (!catRow) {
      return {
        text: `Category "${input.new_category_name}" not found.`,
        summary: `Failed: category "${input.new_category_name}" not found`,
      }
    }
    updates.category_id = catRow.id
    changeParts.push(`category → ${catRow.name}`)
  }
  if (typeof input.new_description === 'string' && input.new_description.trim()) {
    updates.description = input.new_description.trim()
    changeParts.push(`description → "${updates.description}"`)
  }
  if (typeof input.new_notes === 'string') {
    updates.notes = input.new_notes
    changeParts.push('notes updated')
  }

  if (Object.keys(updates).length === 0) {
    return { text: 'No changes specified. Provide new_category_name, new_description, or new_notes.', summary: 'Failed: nothing to update' }
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', txn.id)
    .eq('user_id', userId)

  if (updateError) {
    return { text: `Error updating transaction: ${updateError.message}`, summary: `Failed: ${updateError.message}` }
  }

  const sign = txn.cr_dr === 'credit' ? '+' : '-'
  const text = [
    'Transaction updated successfully.',
    `Transaction: ${txn.description} ${sign}${fmt(Math.abs(txn.amount_usd ?? 0))} (${txn.date})`,
    `Changes: ${changeParts.join('; ')}`,
  ].join('\n')

  const summary = `Updated transaction "${txn.description}" — ${changeParts.join('; ')}`
  return { text, summary }
}

async function execUpdateSavingsGoal(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const goalName = typeof input.goal_name === 'string' ? input.goal_name : ''

  let goal: { id: string; name: string; current_amount: number; target_amount: number; monthly_contribution: number; status: string } | null = null
  if (typeof input.goal_id === 'string') {
    const { data } = await supabase
      .from('savings_goals')
      .select('id, name, current_amount, target_amount, monthly_contribution, status')
      .eq('user_id', userId)
      .eq('id', input.goal_id)
      .maybeSingle()
    goal = data
  } else {
    const { data: candidates } = await supabase
      .from('savings_goals')
      .select('id, name, current_amount, target_amount, monthly_contribution, status')
      .eq('user_id', userId)
      .ilike('name', like(goalName))
      .limit(5)
    const rows = candidates ?? []
    goal =
      rows.length === 1
        ? rows[0]
        : rows.find((r) => r.name.toLowerCase() === goalName.toLowerCase()) ?? null
    if (!goal && rows.length > 1) {
      const names = rows.map((r) => `"${r.name}"`).join(', ')
      return {
        text: `Multiple savings goals match "${goalName}": ${names}. Please specify which one.`,
        summary: `Failed: ambiguous goal "${goalName}"`,
      }
    }
  }

  if (!goal) {
    return { text: `Savings goal "${goalName}" not found.`, summary: `Failed: goal "${goalName}" not found` }
  }

  const updates: Record<string, unknown> = {}
  const changeParts: string[] = []

  if (typeof input.add_amount === 'number' && input.add_amount !== 0) {
    updates.current_amount = goal.current_amount + input.add_amount
    changeParts.push(`saved amount ${fmt(goal.current_amount)} → ${fmt(goal.current_amount + input.add_amount)}`)
  }
  if (typeof input.monthly_contribution === 'number') {
    updates.monthly_contribution = input.monthly_contribution
    changeParts.push(`monthly contribution → ${fmt(input.monthly_contribution)}`)
  }
  if (typeof input.target_amount === 'number') {
    updates.target_amount = input.target_amount
    changeParts.push(`target → ${fmt(input.target_amount)}`)
  }
  if (typeof input.status === 'string' && ['active', 'paused', 'completed'].includes(input.status)) {
    updates.status = input.status
    changeParts.push(`status → ${input.status}`)
  }

  if (Object.keys(updates).length === 0) {
    return { text: 'No changes specified. Provide add_amount, monthly_contribution, target_amount, or status.', summary: 'Failed: nothing to update' }
  }

  const { error: updateError } = await supabase
    .from('savings_goals')
    .update(updates)
    .eq('id', goal.id)
    .eq('user_id', userId)

  if (updateError) {
    return { text: `Error updating savings goal: ${updateError.message}`, summary: `Failed: ${updateError.message}` }
  }

  const newCurrent = typeof updates.current_amount === 'number' ? updates.current_amount : goal.current_amount
  const newTarget = typeof updates.target_amount === 'number' ? updates.target_amount : goal.target_amount
  const progress = newTarget > 0 ? ((newCurrent / newTarget) * 100).toFixed(1) : '0.0'

  const text = [
    'Savings goal updated successfully.',
    `Goal: ${goal.name}`,
    `Changes: ${changeParts.join('; ')}`,
    `Progress: ${fmt(newCurrent)} / ${fmt(newTarget)} (${progress}%)`,
  ].join('\n')

  const summary = `Updated goal "${goal.name}" — ${changeParts.join('; ')}`
  return { text, summary }
}

async function execUpdateSubscription(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const subName = typeof input.subscription_name === 'string' ? input.subscription_name : ''

  let sub: { id: string; name: string; billing_cost: number; billing_cycle_months: number; status: string; auto_renew: boolean } | null = null
  if (typeof input.subscription_id === 'string') {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, name, billing_cost, billing_cycle_months, status, auto_renew')
      .eq('user_id', userId)
      .eq('id', input.subscription_id)
      .maybeSingle()
    sub = data
  } else {
    const { data: candidates } = await supabase
      .from('subscriptions')
      .select('id, name, billing_cost, billing_cycle_months, status, auto_renew')
      .eq('user_id', userId)
      .ilike('name', like(subName))
      .limit(5)
    const rows = candidates ?? []
    sub =
      rows.length === 1
        ? rows[0]
        : rows.find((r) => r.name.toLowerCase() === subName.toLowerCase()) ?? null
    if (!sub && rows.length > 1) {
      const names = rows.map((r) => `"${r.name}"`).join(', ')
      return {
        text: `Multiple subscriptions match "${subName}": ${names}. Please specify which one.`,
        summary: `Failed: ambiguous subscription "${subName}"`,
      }
    }
  }

  if (!sub) {
    return { text: `Subscription "${subName}" not found.`, summary: `Failed: subscription "${subName}" not found` }
  }

  const updates: Record<string, unknown> = {}
  const changeParts: string[] = []

  if (typeof input.status === 'string' && ['active', 'inactive', 'cancelled'].includes(input.status)) {
    updates.status = input.status
    changeParts.push(`status → ${input.status}`)
  }
  if (typeof input.billing_cost === 'number' && input.billing_cost >= 0) {
    updates.billing_cost = input.billing_cost
    changeParts.push(`cost ${fmt(sub.billing_cost)} → ${fmt(input.billing_cost)}`)
  }
  if (typeof input.auto_renew === 'boolean') {
    updates.auto_renew = input.auto_renew
    changeParts.push(`auto-renew → ${input.auto_renew ? 'on' : 'off'}`)
  }

  if (Object.keys(updates).length === 0) {
    return { text: 'No changes specified. Provide status, billing_cost, or auto_renew.', summary: 'Failed: nothing to update' }
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', sub.id)
    .eq('user_id', userId)

  if (updateError) {
    return { text: `Error updating subscription: ${updateError.message}`, summary: `Failed: ${updateError.message}` }
  }

  const text = [
    'Subscription updated successfully.',
    `Subscription: ${sub.name} (${fmt(sub.billing_cost)} every ${sub.billing_cycle_months === 1 ? 'month' : `${sub.billing_cycle_months} months`})`,
    `Changes: ${changeParts.join('; ')}`,
  ].join('\n')

  const summary = `Updated subscription "${sub.name}" — ${changeParts.join('; ')}`
  return { text, summary }
}

async function execTransferFunds(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string,
): Promise<ToolResult> {
  const amount = input.amount as number
  const date = typeof input.date === 'string' ? input.date : todayInTz(tz)
  const notes = typeof input.notes === 'string' ? input.notes : null
  const description = typeof input.description === 'string' ? input.description.trim() : ''

  const sourceAccountId = input.source_account_id as string
  const sourceCurrency: CurrencyCode = (input.source_currency as CurrencyCode) ?? 'USD'
  const sourceName = input.source_display as string

  const targetAccountId = input.target_account_id as string
  const targetCurrency: CurrencyCode = (input.target_currency as CurrencyCode) ?? 'USD'
  const targetName = input.target_display as string

  // Verify ownership of both accounts before touching SECURITY DEFINER RPC
  const [srcAcct, tgtAcct] = await Promise.all([
    verifyAccountOwned(sourceAccountId, userId, supabase),
    verifyAccountOwned(targetAccountId, userId, supabase),
  ])
  if (!srcAcct) return { text: 'Transfer source account not found or not accessible.', summary: 'Transfer failed: source not found' }
  if (!tgtAcct) return { text: 'Transfer destination account not found or not accessible.', summary: 'Transfer failed: destination not found' }

  const sourceFxRate = sourceCurrency !== 'USD' ? await getFxRate(sourceCurrency, 'USD') : 1
  const targetFxRate = targetCurrency !== 'USD' ? await getFxRate(targetCurrency, 'USD') : 1
  const sourceUsdAmt = convertAmount(amount, sourceFxRate)
  const targetNativeAmt = targetFxRate ? sourceUsdAmt / targetFxRate : sourceUsdAmt

  const transferGroupId = randomUUID()

  // Find Transfer category (best-effort, non-fatal)
  const { data: transferCat } = await supabase
    .from('categories').select('id').eq('user_id', userId).eq('name', 'Transfer').maybeSingle()
  const transferCategoryId = transferCat?.id ?? null

  const debitDesc = description || `Transfer to ${targetName}`
  const creditDesc = description || `Transfer from ${sourceName}`

  const { data: txnA, error: errA } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: sourceAccountId,
      category_id: transferCategoryId,
      description: debitDesc,
      amount_usd: -sourceUsdAmt,
      final_amount: -sourceUsdAmt,
      amount_original: amount,
      original_currency: sourceCurrency,
      cr_dr: 'debit',
      date,
      notes,
      source: 'manual',
      import_status: 'confirmed',
      flagged: false,
      is_recurring: false,
      ai_categorized: false,
      is_internal_transfer: true,
      transfer_group_id: transferGroupId,
    })
    .select('id')
    .single()

  if (errA || !txnA) {
    return { text: `Error creating transfer (source leg): ${errA?.message ?? 'unknown error'}`, summary: 'Transfer failed' }
  }

  const { data: txnB, error: errB } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: targetAccountId,
      category_id: transferCategoryId,
      description: creditDesc,
      amount_usd: sourceUsdAmt,
      final_amount: sourceUsdAmt,
      amount_original: targetNativeAmt,
      original_currency: targetCurrency,
      cr_dr: 'credit',
      date,
      notes,
      source: 'manual',
      import_status: 'confirmed',
      flagged: false,
      is_recurring: false,
      ai_categorized: false,
      is_internal_transfer: true,
      transfer_group_id: transferGroupId,
      linked_transaction_id: txnA.id,
    })
    .select('id')
    .single()

  if (errB || !txnB) {
    await supabase.from('transactions').delete().eq('id', txnA.id).eq('user_id', userId)
    return { text: `Error creating transfer (destination leg): ${errB?.message ?? 'unknown error'}`, summary: 'Transfer failed' }
  }

  // Cross-link source → destination
  await supabase.from('transactions').update({ linked_transaction_id: txnB.id }).eq('id', txnA.id).eq('user_id', userId)

  // Update account balances via RPC (increment_account_balance is SECURITY DEFINER)
  await Promise.all([
    supabase.rpc('increment_account_balance', { p_account_id: sourceAccountId, p_delta: -amount }),
    supabase.rpc('increment_account_balance', { p_account_id: targetAccountId, p_delta: targetNativeAmt }),
  ])

  const text = [
    'Transfer completed successfully.',
    `From: ${sourceName} (−${fmt(amount)} ${sourceCurrency})`,
    `To: ${targetName} (+${fmt(targetNativeAmt)} ${targetCurrency})`,
    `Date: ${date}`,
    `Transfer Group ID: ${transferGroupId}`,
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n')
  return { text, summary: `Transferred ${fmt(amount)} from ${sourceName} to ${targetName}` }
}

async function execDeleteTransaction(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const transactionId = input.transaction_id as string

  // Fetch full details for balance reversal
  const { data: txn } = await supabase
    .from('transactions')
    .select('id, description, amount_usd, cr_dr, date, account_id, loan_id, is_internal_transfer, linked_transaction_id')
    .eq('user_id', userId)
    .eq('id', transactionId)
    .maybeSingle()

  if (!txn) {
    return { text: `Transaction not found (id: ${transactionId}).`, summary: 'Failed: transaction not found' }
  }

  // If it's a transfer, delete the paired leg too
  if (txn.is_internal_transfer && txn.linked_transaction_id) {
    const { data: paired } = await supabase
      .from('transactions')
      .select('id, account_id, amount_usd')
      .eq('user_id', userId)
      .eq('id', txn.linked_transaction_id)
      .maybeSingle()

    if (paired) {
      await supabase.rpc('increment_account_balance', { p_account_id: paired.account_id, p_delta: -(paired.amount_usd ?? 0) })
      await supabase.from('transactions').delete().eq('id', paired.id)
    }
  }

  // Reverse the source transaction's balance effect
  await supabase.rpc('increment_account_balance', { p_account_id: txn.account_id, p_delta: -(txn.amount_usd ?? 0) })

  // Reverse loan balance if linked
  if (txn.loan_id) {
    const { data: loan } = await supabase.from('loans').select('current_balance').eq('id', txn.loan_id).maybeSingle()
    if (loan) {
      const reverseDelta = txn.amount_usd ?? 0 // debit was negative → adding it back increases loan balance
      await supabase
        .from('loans')
        .update({ current_balance: Math.max(0, loan.current_balance + reverseDelta) })
        .eq('id', txn.loan_id)
    }
  }

  const { error: delErr } = await supabase.from('transactions').delete().eq('id', txn.id).eq('user_id', userId)
  if (delErr) {
    return { text: `Error deleting transaction: ${delErr.message}`, summary: `Failed: ${delErr.message}` }
  }

  const sign = txn.cr_dr === 'credit' ? '+' : '-'
  const text = [
    'Transaction deleted successfully.',
    `Description: ${txn.description}`,
    `Amount: ${sign}${fmt(Math.abs(txn.amount_usd ?? 0))}`,
    `Date: ${txn.date}`,
    txn.is_internal_transfer ? '(Both transfer legs removed)' : '',
  ].filter(Boolean).join('\n')
  return { text, summary: `Deleted transaction: ${txn.description} (${txn.date})` }
}

async function execCreateAccount(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const name = input.name as string
  const type = input.type as string
  const kind = input.kind as string
  const institution = typeof input.institution === 'string' ? input.institution : null
  const currency = (typeof input.currency === 'string' ? input.currency : 'USD').toUpperCase()
  const balance = typeof input.current_balance === 'number' ? input.current_balance : 0
  const notes = typeof input.notes === 'string' ? input.notes : null

  const { data: acct, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name,
      type,
      kind,
      institution,
      currency,
      current_balance: balance,
      opening_balance: balance,
      is_active: true,
      is_india_account: currency === 'INR',
      notes,
    })
    .select('id, name')
    .single()

  if (error || !acct) {
    return { text: `Error creating account: ${error?.message ?? 'unknown error'}`, summary: 'Failed to create account' }
  }

  const text = [
    'Account created successfully.',
    `ID: ${acct.id}`,
    `Name: ${name}`,
    `Type: ${kind}/${type}`,
    institution ? `Institution: ${institution}` : '',
    `Currency: ${currency}`,
    `Opening Balance: ${fmt(balance)}`,
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n')
  return { text, summary: `Created account: ${name} (${kind}/${type})` }
}

async function execUpdateAccount(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let accountId: string | null = null
  let accountName: string = input.account_name as string

  if (typeof input.account_id === 'string') {
    accountId = input.account_id
    accountName = typeof input.account_display === 'string' ? input.account_display : accountId
  } else {
    const { data } = await supabase
      .from('accounts').select('id, name').eq('user_id', userId).eq('is_active', true)
      .ilike('name', like(input.account_name as string)).limit(1).maybeSingle()
    if (!data) return { text: `Account "${input.account_name}" not found.`, summary: 'Failed: account not found' }
    accountId = data.id
    accountName = data.name
  }

  const updates: Record<string, unknown> = {}
  const changeParts: string[] = []

  if (typeof input.new_name === 'string' && input.new_name.trim()) {
    updates.name = input.new_name.trim()
    changeParts.push(`name → "${input.new_name.trim()}"`)
  }
  if (typeof input.institution === 'string') {
    updates.institution = input.institution
    changeParts.push(`institution → "${input.institution}"`)
  }
  if (typeof input.current_balance === 'number') {
    updates.current_balance = input.current_balance
    changeParts.push(`balance → ${fmt(input.current_balance)}`)
  }
  if (typeof input.notes === 'string') {
    updates.notes = input.notes
    changeParts.push('notes updated')
  }

  if (Object.keys(updates).length === 0) {
    return { text: 'No changes specified.', summary: 'Nothing to update' }
  }

  const { error } = await supabase.from('accounts').update(updates).eq('id', accountId).eq('user_id', userId)
  if (error) return { text: `Error updating account: ${error.message}`, summary: `Failed: ${error.message}` }

  const text = [`Account updated successfully.`, `Account: ${accountName}`, `Changes: ${changeParts.join('; ')}`].join('\n')
  return { text, summary: `Updated account "${accountName}" — ${changeParts.join('; ')}` }
}

async function execCreateSubscription(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const name = input.name as string
  const billingCost = input.billing_cost as number
  const cycleMonths = typeof input.billing_cycle_months === 'number' ? input.billing_cycle_months : 1
  const nextBillingDate = typeof input.next_billing_date === 'string' ? input.next_billing_date : null
  const autoRenew = typeof input.auto_renew === 'boolean' ? input.auto_renew : true
  const notes = typeof input.notes === 'string' ? input.notes : null

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      name,
      billing_cost: billingCost,
      billing_cycle_months: cycleMonths,
      next_billing_date: nextBillingDate,
      billing_start_date: nextBillingDate,
      status: 'active',
      auto_renew: autoRenew,
      notes,
    })
    .select('id, name')
    .single()

  if (error || !sub) {
    return { text: `Error creating subscription: ${error?.message ?? 'unknown error'}`, summary: 'Failed to create subscription' }
  }

  const cycleLabel = cycleMonths === 1 ? 'monthly' : cycleMonths === 12 ? 'annually' : `every ${cycleMonths} months`
  const text = [
    'Subscription created successfully.',
    `ID: ${sub.id}`,
    `Name: ${name}`,
    `Cost: ${fmt(billingCost)} ${cycleLabel}`,
    nextBillingDate ? `Next Billing: ${nextBillingDate}` : '',
    `Auto-renew: ${autoRenew ? 'yes' : 'no'}`,
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n')
  return { text, summary: `Created subscription: ${name} (${fmt(billingCost)} ${cycleLabel})` }
}

async function execDeleteSubscription(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let subId: string
  let subName: string

  if (typeof input.subscription_id === 'string') {
    subId = input.subscription_id
    subName = typeof input.subscription_display === 'string' ? input.subscription_display : subId
  } else {
    const { data } = await supabase
      .from('subscriptions').select('id, name').eq('user_id', userId)
      .ilike('name', like(input.subscription_name as string)).limit(1).maybeSingle()
    if (!data) return { text: `Subscription "${input.subscription_name}" not found.`, summary: 'Failed: not found' }
    subId = data.id
    subName = data.name
  }

  const { error } = await supabase.from('subscriptions').delete().eq('id', subId).eq('user_id', userId)
  if (error) return { text: `Error deleting subscription: ${error.message}`, summary: `Failed: ${error.message}` }

  return { text: `Subscription "${subName}" deleted successfully.`, summary: `Deleted subscription: ${subName}` }
}

async function execLogSubscriptionPayment(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string,
): Promise<ToolResult> {
  let subId: string
  let subName: string
  let nextBillingDate: string

  if (typeof input.subscription_id === 'string') {
    subId = input.subscription_id
    subName = typeof input.subscription_display === 'string' ? input.subscription_display : subId
    nextBillingDate = input.next_billing_date as string
  } else {
    // Fallback: re-resolve
    const { data } = await supabase
      .from('subscriptions').select('id, name, billing_cycle_months, next_billing_date')
      .eq('user_id', userId).ilike('name', like(input.subscription_name as string)).limit(1).maybeSingle()
    if (!data) return { text: `Subscription "${input.subscription_name}" not found.`, summary: 'Failed: not found' }
    subId = data.id
    subName = data.name
    const baseDate = data.next_billing_date ? new Date(`${data.next_billing_date}T12:00:00`) : new Date()
    const next = new Date(baseDate)
    next.setMonth(next.getMonth() + (data.billing_cycle_months || 1))
    nextBillingDate = next.toISOString().split('T')[0]
  }

  const { error } = await supabase
    .from('subscriptions').update({ next_billing_date: nextBillingDate }).eq('id', subId).eq('user_id', userId)
  if (error) return { text: `Error logging payment: ${error.message}`, summary: `Failed: ${error.message}` }

  const text = [
    'Subscription payment logged.',
    `Subscription: ${subName}`,
    `Next billing date advanced to: ${nextBillingDate}`,
    typeof input.payment_date === 'string' ? `Payment date: ${input.payment_date}` : `Payment date: ${todayInTz(tz)}`,
  ].join('\n')
  return { text, summary: `Logged payment for "${subName}", next billing: ${nextBillingDate}` }
}

async function execLogLoanPayment(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  _tz: string,
): Promise<ToolResult> {
  const loanId = input.loan_id as string
  const loanName = input.loan_display as string
  const newLoanBalance = input.new_loan_balance as number
  const paymentAmount = input.payment_amount as number
  const date = input.date as string

  // Reduce loan balance
  const { error: loanErr } = await supabase
    .from('loans').update({ current_balance: newLoanBalance }).eq('id', loanId).eq('user_id', userId)
  if (loanErr) return { text: `Error updating loan balance: ${loanErr.message}`, summary: `Failed: ${loanErr.message}` }

  // Optionally create a debit transaction
  let txnNote = ''
  if (typeof input.from_account_id === 'string') {
    const fromAcct = await verifyAccountOwned(input.from_account_id, userId, supabase)
    if (!fromAcct) {
      return { text: 'Payment source account not found or not owned by you.', summary: 'Failed: account not owned' }
    }
    const { data: txn } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: input.from_account_id,
        description: `Payment — ${loanName}`,
        amount_usd: -paymentAmount,
        final_amount: -paymentAmount,
        amount_original: paymentAmount,
        original_currency: 'USD',
        cr_dr: 'debit',
        date,
        notes: typeof input.notes === 'string' ? input.notes : null,
        loan_id: loanId,
        source: 'manual',
        import_status: 'confirmed',
        flagged: false,
        is_recurring: false,
        ai_categorized: false,
        is_internal_transfer: false,
      })
      .select('id')
      .maybeSingle()

    if (txn) {
      await supabase.rpc('increment_account_balance', { p_account_id: input.from_account_id, p_delta: -paymentAmount })
      txnNote = `\nTransaction created on ${input.from_account_display ?? 'account'}: −${fmt(paymentAmount)}`
    }
  }

  const text = [
    'Loan payment logged successfully.',
    `Loan: ${loanName}`,
    `Payment: ${fmt(paymentAmount)}`,
    `New Balance: ${fmt(newLoanBalance)}`,
    `Date: ${date}`,
  ].join('\n') + txnNote
  return { text, summary: `Logged ${fmt(paymentAmount)} payment on "${loanName}", balance now ${fmt(newLoanBalance)}` }
}

async function execDeleteSavingsGoal(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let goalId: string
  let goalName: string

  if (typeof input.goal_id === 'string') {
    goalId = input.goal_id
    goalName = typeof input.goal_display === 'string' ? input.goal_display : goalId
  } else {
    const { data } = await supabase
      .from('savings_goals').select('id, name').eq('user_id', userId)
      .ilike('name', like(input.goal_name as string)).limit(1).maybeSingle()
    if (!data) return { text: `Savings goal "${input.goal_name}" not found.`, summary: 'Failed: not found' }
    goalId = data.id
    goalName = data.name
  }

  const { error } = await supabase.from('savings_goals').delete().eq('id', goalId).eq('user_id', userId)
  if (error) return { text: `Error deleting savings goal: ${error.message}`, summary: `Failed: ${error.message}` }

  return { text: `Savings goal "${goalName}" deleted successfully.`, summary: `Deleted savings goal: ${goalName}` }
}

async function execCreateInvestment(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const ticker = (input.ticker as string).toUpperCase()
  const type = input.type as string
  const platform = input.platform as string
  const totalInvested = input.total_invested as number
  const currentValue = input.current_value as number
  const notes = typeof input.notes === 'string' ? input.notes : null

  const { data: inv, error } = await supabase
    .from('investments')
    .insert({
      user_id: userId,
      ticker,
      type,
      platform,
      total_invested: totalInvested,
      current_value: currentValue,
      notes,
      last_updated: new Date().toISOString().split('T')[0],
    })
    .select('id, ticker, platform')
    .single()

  if (error || !inv) {
    return { text: `Error creating investment: ${error?.message ?? 'unknown error'}`, summary: 'Failed to create investment' }
  }

  const gl = currentValue - totalInvested
  const text = [
    'Investment created successfully.',
    `ID: ${inv.id}`,
    `Ticker: ${ticker}`,
    `Type: ${type}`,
    `Platform: ${platform}`,
    `Total Invested: ${fmt(totalInvested)}`,
    `Current Value: ${fmt(currentValue)}`,
    `Gain/Loss: ${gl >= 0 ? '+' : ''}${fmt(gl)}`,
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n')
  return { text, summary: `Created investment: ${ticker} on ${platform} (${fmt(currentValue)} value)` }
}

async function execUpdateInvestment(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let invId: string
  let invDisplay: string

  if (typeof input.investment_id === 'string') {
    invId = input.investment_id
    invDisplay = typeof input.investment_display === 'string' ? input.investment_display : invId
  } else {
    const filter = input.ticker_or_platform as string
    const { data: rows } = await supabase
      .from('investments').select('id, ticker, platform').eq('user_id', userId)
      .or(`ticker.ilike.${like(filter)},platform.ilike.${like(filter)}`).limit(1)
    if (!rows || rows.length === 0) return { text: `Investment "${filter}" not found.`, summary: 'Failed: not found' }
    invId = rows[0].id
    invDisplay = `${rows[0].ticker} on ${rows[0].platform}`
  }

  const updates: Record<string, unknown> = { last_updated: new Date().toISOString().split('T')[0] }
  const changeParts: string[] = []

  if (typeof input.current_value === 'number') { updates.current_value = input.current_value; changeParts.push(`value → ${fmt(input.current_value)}`) }
  if (typeof input.total_invested === 'number') { updates.total_invested = input.total_invested; changeParts.push(`invested → ${fmt(input.total_invested)}`) }
  if (typeof input.notes === 'string') { updates.notes = input.notes; changeParts.push('notes updated') }

  if (changeParts.length === 0) return { text: 'No changes specified.', summary: 'Nothing to update' }

  const { error } = await supabase.from('investments').update(updates).eq('id', invId).eq('user_id', userId)
  if (error) return { text: `Error updating investment: ${error.message}`, summary: `Failed: ${error.message}` }

  return { text: `Investment ${invDisplay} updated: ${changeParts.join('; ')}`, summary: `Updated ${invDisplay} — ${changeParts.join('; ')}` }
}

async function execDeleteInvestment(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let invId: string
  let invDisplay: string

  if (typeof input.investment_id === 'string') {
    invId = input.investment_id
    invDisplay = typeof input.investment_display === 'string' ? input.investment_display : invId
  } else {
    const filter = input.ticker_or_platform as string
    const { data: rows } = await supabase
      .from('investments').select('id, ticker, platform').eq('user_id', userId)
      .or(`ticker.ilike.${like(filter)},platform.ilike.${like(filter)}`).limit(1)
    if (!rows || rows.length === 0) return { text: `Investment "${filter}" not found.`, summary: 'Failed: not found' }
    invId = rows[0].id
    invDisplay = `${rows[0].ticker} on ${rows[0].platform}`
  }

  const { error } = await supabase.from('investments').delete().eq('id', invId).eq('user_id', userId)
  if (error) return { text: `Error deleting investment: ${error.message}`, summary: `Failed: ${error.message}` }

  return { text: `Investment ${invDisplay} deleted successfully.`, summary: `Deleted investment: ${invDisplay}` }
}

async function execCreatePaycheck(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  _tz: string,
): Promise<ToolResult> {
  const employer = input.employer as string
  const date = input.date as string
  const grossPay = input.gross_pay as number
  const netPay = input.net_pay as number
  const federalTax = typeof input.federal_tax === 'number' ? input.federal_tax : 0
  const stateTax = typeof input.state_tax === 'number' ? input.state_tax : 0
  const sdi = typeof input.sdi === 'number' ? input.sdi : 0
  const retirement401k = typeof input.retirement_401k === 'number' ? input.retirement_401k : 0
  const employer401kMatch = typeof input.employer_401k_match === 'number' ? input.employer_401k_match : 0
  const otherDeductions = typeof input.other_deductions === 'number' ? input.other_deductions : 0
  const notes = typeof input.notes === 'string' ? input.notes : null

  const depositAccountId = typeof input.deposit_account_id === 'string' ? input.deposit_account_id : null
  const depositAccountDisplay = typeof input.deposit_account_display === 'string' ? input.deposit_account_display : null

  let transactionId: string | null = null

  if (depositAccountId) {
    const depositAcct = await verifyAccountOwned(depositAccountId, userId, supabase)
    if (!depositAcct) {
      return { text: 'Deposit account not found or not owned by you.', summary: 'Failed: account not owned' }
    }
    const { data: txn } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: depositAccountId,
        description: `Paycheck — ${employer}`,
        amount_usd: netPay,
        final_amount: netPay,
        amount_original: netPay,
        original_currency: 'USD',
        cr_dr: 'credit',
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
      .maybeSingle()

    if (txn) {
      transactionId = txn.id
      await supabase.rpc('increment_account_balance', { p_account_id: depositAccountId, p_delta: netPay })
    }
  }

  const { data: paycheck, error } = await supabase
    .from('paychecks')
    .insert({
      user_id: userId,
      account_id: depositAccountId,
      employer,
      date,
      gross_pay: grossPay,
      net_pay: netPay,
      federal_tax: federalTax,
      state_tax: stateTax,
      sdi,
      other_deductions: otherDeductions,
      retirement_401k: retirement401k,
      employer_401k_match: employer401kMatch,
      employee_401k_pct: grossPay > 0 ? (retirement401k / grossPay) * 100 : 0,
      notes,
      transaction_id: transactionId,
    })
    .select('id')
    .single()

  if (error || !paycheck) {
    return { text: `Error logging paycheck: ${error?.message ?? 'unknown error'}`, summary: 'Failed to log paycheck' }
  }

  const text = [
    'Paycheck logged successfully.',
    `ID: ${paycheck.id}`,
    `Employer: ${employer}`,
    `Date: ${date}`,
    `Gross Pay: ${fmt(grossPay)}`,
    `Net Pay: ${fmt(netPay)}`,
    federalTax ? `Federal Tax: ${fmt(federalTax)}` : '',
    stateTax ? `State Tax: ${fmt(stateTax)}` : '',
    retirement401k ? `401k Contribution: ${fmt(retirement401k)}` : '',
    employer401kMatch ? `Employer 401k Match: ${fmt(employer401kMatch)}` : '',
    depositAccountDisplay ? `Deposit to: ${depositAccountDisplay}` : '',
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n')
  return { text, summary: `Logged paycheck from ${employer} on ${date}: gross ${fmt(grossPay)}, net ${fmt(netPay)}` }
}

async function execCreateRecurringRule(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  const description = input.description as string
  const amountUsd = input.amount_usd as number
  const crDr = input.cr_dr as 'credit' | 'debit'
  const frequency = input.frequency as string
  const nextDue = input.next_due as string
  const accountId = input.account_id as string
  const categoryId = typeof input.category_id === 'string' ? input.category_id : null
  const notes = typeof input.notes === 'string' ? input.notes : null

  const { data: rule, error } = await supabase
    .from('recurring_rules')
    .insert({
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      description,
      amount_usd: amountUsd,
      cr_dr: crDr,
      frequency,
      next_due: nextDue,
      is_active: true,
      notes,
    })
    .select('id')
    .single()

  if (error || !rule) {
    return { text: `Error creating recurring rule: ${error?.message ?? 'unknown error'}`, summary: 'Failed to create rule' }
  }

  const sign = crDr === 'credit' ? '+' : '-'
  const text = [
    'Recurring rule created successfully.',
    `ID: ${rule.id}`,
    `Description: ${description}`,
    `Amount: ${sign}${fmt(amountUsd)}`,
    `Frequency: ${frequency}`,
    `Next Due: ${nextDue}`,
    `Account: ${input.account_display ?? accountId}`,
    input.category_display ? `Category: ${input.category_display}` : '',
    notes ? `Notes: ${notes}` : '',
  ].filter(Boolean).join('\n')
  return { text, summary: `Created recurring rule: "${description}" ${sign}${fmt(amountUsd)} ${frequency}` }
}

async function execUpdateRecurringRule(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let ruleId: string
  let ruleDisplay: string

  if (typeof input.rule_id === 'string') {
    ruleId = input.rule_id
    ruleDisplay = typeof input.rule_display === 'string' ? input.rule_display : ruleId
  } else {
    const { data } = await supabase
      .from('recurring_rules').select('id, description').eq('user_id', userId)
      .ilike('description', like(input.rule_description as string)).limit(1).maybeSingle()
    if (!data) return { text: `Rule "${input.rule_description}" not found.`, summary: 'Failed: not found' }
    ruleId = data.id
    ruleDisplay = data.description
  }

  const updates: Record<string, unknown> = {}
  const changeParts: string[] = []

  if (typeof input.new_description === 'string' && input.new_description.trim()) {
    updates.description = input.new_description.trim()
    changeParts.push(`description → "${input.new_description.trim()}"`)
  }
  if (typeof input.amount_usd === 'number') { updates.amount_usd = input.amount_usd; changeParts.push(`amount → ${fmt(input.amount_usd)}`) }
  if (typeof input.frequency === 'string') { updates.frequency = input.frequency; changeParts.push(`frequency → ${input.frequency}`) }
  if (typeof input.next_due === 'string') { updates.next_due = input.next_due; changeParts.push(`next due → ${input.next_due}`) }
  if (typeof input.is_active === 'boolean') { updates.is_active = input.is_active; changeParts.push(input.is_active ? 'activated' : 'paused') }
  if (typeof input.category_id === 'string') { updates.category_id = input.category_id; changeParts.push(`category → ${input.category_display ?? input.category_id}`) }

  if (Object.keys(updates).length === 0) return { text: 'No changes specified.', summary: 'Nothing to update' }

  const { error } = await supabase.from('recurring_rules').update(updates).eq('id', ruleId).eq('user_id', userId)
  if (error) return { text: `Error updating rule: ${error.message}`, summary: `Failed: ${error.message}` }

  return { text: `Recurring rule "${ruleDisplay}" updated: ${changeParts.join('; ')}`, summary: `Updated rule "${ruleDisplay}" — ${changeParts.join('; ')}` }
}

async function execDeleteRecurringRule(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
): Promise<ToolResult> {
  let ruleId: string
  let ruleDisplay: string

  if (typeof input.rule_id === 'string') {
    ruleId = input.rule_id
    ruleDisplay = typeof input.rule_display === 'string' ? input.rule_display : ruleId
  } else {
    const { data } = await supabase
      .from('recurring_rules').select('id, description').eq('user_id', userId)
      .ilike('description', like(input.rule_description as string)).limit(1).maybeSingle()
    if (!data) return { text: `Rule "${input.rule_description}" not found.`, summary: 'Failed: not found' }
    ruleId = data.id
    ruleDisplay = data.description
  }

  const { error } = await supabase.from('recurring_rules').delete().eq('id', ruleId).eq('user_id', userId)
  if (error) return { text: `Error deleting rule: ${error.message}`, summary: `Failed: ${error.message}` }

  return { text: `Recurring rule "${ruleDisplay}" deleted successfully.`, summary: `Deleted recurring rule: ${ruleDisplay}` }
}

export async function executeWriteTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string = DEFAULT_TZ,
): Promise<ToolResult> {
  try {
    const validationError = validateWriteInput(name, input)
    if (validationError) {
      return { text: validationError, summary: `Invalid input: ${validationError}` }
    }
    switch (name) {
      case 'create_transaction':
        return await execCreateTransaction(input, userId, supabase, tz)
      case 'flag_transaction':
        return await execFlagTransaction(input, userId, supabase)
      case 'update_transaction':
        return await execUpdateTransaction(input, userId, supabase)
      case 'update_budget':
        return await execUpdateBudget(input, userId, supabase, tz)
      case 'create_savings_goal':
        return await execCreateSavingsGoal(input, userId, supabase)
      case 'update_savings_goal':
        return await execUpdateSavingsGoal(input, userId, supabase)
      case 'update_subscription':
        return await execUpdateSubscription(input, userId, supabase)
      case 'transfer_funds':
        return await execTransferFunds(input, userId, supabase, tz)
      case 'delete_transaction':
        return await execDeleteTransaction(input, userId, supabase)
      case 'create_account':
        return await execCreateAccount(input, userId, supabase)
      case 'update_account':
        return await execUpdateAccount(input, userId, supabase)
      case 'create_subscription':
        return await execCreateSubscription(input, userId, supabase)
      case 'delete_subscription':
        return await execDeleteSubscription(input, userId, supabase)
      case 'log_subscription_payment':
        return await execLogSubscriptionPayment(input, userId, supabase, tz)
      case 'log_loan_payment':
        return await execLogLoanPayment(input, userId, supabase, tz)
      case 'delete_savings_goal':
        return await execDeleteSavingsGoal(input, userId, supabase)
      case 'create_investment':
        return await execCreateInvestment(input, userId, supabase)
      case 'update_investment':
        return await execUpdateInvestment(input, userId, supabase)
      case 'delete_investment':
        return await execDeleteInvestment(input, userId, supabase)
      case 'create_paycheck':
        return await execCreatePaycheck(input, userId, supabase, tz)
      case 'create_recurring_rule':
        return await execCreateRecurringRule(input, userId, supabase)
      case 'update_recurring_rule':
        return await execUpdateRecurringRule(input, userId, supabase)
      case 'delete_recurring_rule':
        return await execDeleteRecurringRule(input, userId, supabase)
      default:
        return { text: 'Unknown write tool', summary: 'Unknown write tool' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { text: `Error executing ${name}: ${msg}`, summary: `Failed: ${msg}` }
  }
}
