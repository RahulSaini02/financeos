// src/lib/agent/write-tools.ts
// Write-tool executors and the public executeWriteTool dispatcher.
// All queries are scoped by user_id — never queries without user scope.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getFxRate, convertAmount } from '@/lib/fx'
import type { CurrencyCode } from '@/lib/types'
import { fmt, like, todayInTz, monthStartInTz, DEFAULT_TZ } from './shared'
import type { ToolResult } from './shared'

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

export async function executeWriteTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string = DEFAULT_TZ,
): Promise<ToolResult> {
  try {
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
      default:
        return { text: 'Unknown write tool', summary: 'Unknown write tool' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { text: `Error executing ${name}: ${msg}`, summary: `Failed: ${msg}` }
  }
}
