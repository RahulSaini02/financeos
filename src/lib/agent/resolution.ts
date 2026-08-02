// src/lib/agent/resolution.ts
// Pre-confirmation entity resolution helpers and resolveWriteAction().
// Resolves fuzzy names to concrete records BEFORE the user is asked to confirm,
// so the confirm card shows exactly what will change. Ambiguous or missing
// matches return ok:false with candidates — the model relays this to the user
// instead of the app guessing.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fmt, like, escapeIlike, todayInTz, monthStartInTz, DEFAULT_TZ } from './shared'

export type ResolveResult =
  | { ok: true; resolvedInput: Record<string, unknown>; preview: string }
  | { ok: false; message: string }

function pickByName<T extends { name: string }>(
  rows: T[],
  search: string,
): { match: T } | { ambiguous: T[] } | { none: true } {
  if (rows.length === 0) return { none: true }
  if (rows.length === 1) return { match: rows[0] }
  const exact = rows.filter((r) => r.name.toLowerCase() === search.toLowerCase())
  if (exact.length === 1) return { match: exact[0] }
  return { ambiguous: rows }
}

async function resolveTransactionRef(
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
):
  | Promise<{ ok: true; txn: { id: string; description: string; amount_usd: number; cr_dr: string; date: string } } | { ok: false; message: string }> {
  if (typeof input.transaction_id === 'string' && input.transaction_id.trim()) {
    const { data } = await supabase
      .from('transactions')
      .select('id, description, amount_usd, cr_dr, date')
      .eq('user_id', userId)
      .eq('id', input.transaction_id)
      .maybeSingle()
    if (!data) return { ok: false, message: `No transaction found with id ${input.transaction_id}.` }
    return { ok: true, txn: data }
  }

  const descriptionSearch = typeof input.description === 'string' ? input.description.trim() : ''
  if (!descriptionSearch) {
    return { ok: false, message: 'Provide a transaction_id or a description to search for.' }
  }

  let query = supabase
    .from('transactions')
    .select('id, description, amount_usd, cr_dr, date')
    .eq('user_id', userId)
    .ilike('description', like(descriptionSearch))
    .order('date', { ascending: false })
    .limit(6)
  if (typeof input.date === 'string') query = query.eq('date', input.date)

  const { data: rows } = await query
  const matches = rows ?? []

  if (matches.length === 0) {
    return {
      ok: false,
      message: `No transaction found matching "${descriptionSearch}"${typeof input.date === 'string' ? ` on ${input.date}` : ''}. Try search_transactions with a broader query.`,
    }
  }
  if (matches.length > 1) {
    const candidateLines = matches.map((t) => {
      const sign = t.cr_dr === 'debit' ? '-' : '+'
      return `- id=${t.id} | ${t.date} | ${sign}${fmt(Math.abs(t.amount_usd ?? 0))} | ${t.description}`
    })
    return {
      ok: false,
      message: `Multiple transactions match "${descriptionSearch}". Ask the user which one they mean (or narrow by date), then call again with transaction_id:\n${candidateLines.join('\n')}`,
    }
  }
  return { ok: true, txn: matches[0] }
}

async function resolveCategoryRef(
  name: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ ok: true; category: { id: string; name: string } } | { ok: false; message: string }> {
  const { data: rows } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', like(name))
    .limit(6)

  const picked = pickByName(rows ?? [], name)
  if ('match' in picked) return { ok: true, category: picked.match }
  if ('ambiguous' in picked) {
    const names = picked.ambiguous.map((c) => `"${c.name}"`).join(', ')
    return { ok: false, message: `Multiple categories match "${name}": ${names}. Ask the user which one, then call again with the exact name.` }
  }
  const { data: all } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)
    .order('name')
    .limit(30)
  const available = (all ?? []).map((c) => c.name).join(', ')
  return { ok: false, message: `Category "${name}" not found. Available categories: ${available || 'none'}.` }
}

export async function resolveWriteAction(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient,
  tz: string = DEFAULT_TZ,
): Promise<ResolveResult> {
  try {
    switch (name) {
      case 'create_transaction': {
        const accountName = typeof input.account_name === 'string' ? input.account_name.trim() : ''
        if (!accountName) return { ok: false, message: 'account_name is required.' }
        if (typeof input.amount_usd !== 'number' || input.amount_usd <= 0) {
          return { ok: false, message: 'amount_usd must be a positive number.' }
        }

        const { data: acctRows } = await supabase
          .from('accounts')
          .select('id, name, kind, type')
          .eq('user_id', userId)
          .eq('is_active', true)
          .ilike('name', like(accountName))
          .limit(6)

        const picked = pickByName(acctRows ?? [], accountName)
        if ('none' in picked) {
          const { data: all } = await supabase
            .from('accounts')
            .select('name')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('name')
            .limit(20)
          const available = (all ?? []).map((a) => a.name).join(', ')
          return { ok: false, message: `Account "${accountName}" not found. Available accounts: ${available || 'none'}.` }
        }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((a) => `"${a.name}" (${a.kind}/${a.type})`).join(', ')
          return { ok: false, message: `Multiple accounts match "${accountName}": ${names}. Ask the user which one, then call again with the exact name.` }
        }
        const account = picked.match

        let categoryPart = ''
        const resolved: Record<string, unknown> = { ...input, account_id: account.id, account_display: account.name }
        if (typeof input.category_name === 'string' && input.category_name.trim()) {
          const catRes = await resolveCategoryRef(input.category_name, userId, supabase)
          if (!catRes.ok) return catRes
          resolved.category_id = catRes.category.id
          resolved.category_display = catRes.category.name
          categoryPart = ` · category: ${catRes.category.name}`
        }

        const sign = input.cr_dr === 'credit' ? '+' : '-'
        const date = typeof input.date === 'string' ? input.date : todayInTz(tz)
        const preview = `Log ${input.cr_dr}: "${input.description}" ${sign}${fmt(Math.abs(input.amount_usd as number))} on ${account.name} (${date})${categoryPart}`
        return { ok: true, resolvedInput: resolved, preview }
      }

      case 'create_transactions': {
        const rawItems = Array.isArray(input.items) ? (input.items as Array<Record<string, unknown>>) : []
        if (rawItems.length === 0) return { ok: false, message: 'items must be a non-empty array.' }
        if (rawItems.length > 20) return { ok: false, message: 'Maximum 20 transactions per batch. Split into smaller batches.' }

        const resolvedItems: Array<Record<string, unknown>> = []
        const previewLines: string[] = []

        for (let i = 0; i < rawItems.length; i++) {
          const item = rawItems[i]
          const accountName = typeof item.account_name === 'string' ? item.account_name.trim() : ''
          if (!accountName) return { ok: false, message: `Item ${i + 1}: account_name is required.` }
          if (typeof item.amount_usd !== 'number' || item.amount_usd <= 0) {
            return { ok: false, message: `Item ${i + 1}: amount_usd must be a positive number.` }
          }
          if (!['credit', 'debit'].includes(item.cr_dr as string)) {
            return { ok: false, message: `Item ${i + 1}: cr_dr must be "credit" or "debit".` }
          }

          const { data: acctRows } = await supabase
            .from('accounts')
            .select('id, name, kind, type')
            .eq('user_id', userId)
            .eq('is_active', true)
            .ilike('name', like(accountName))
            .limit(6)

          const picked = pickByName(acctRows ?? [], accountName)
          if ('none' in picked) {
            return { ok: false, message: `Item ${i + 1}: Account "${accountName}" not found.` }
          }
          if ('ambiguous' in picked) {
            const names = picked.ambiguous.map((a: { name: string }) => `"${a.name}"`).join(', ')
            return { ok: false, message: `Item ${i + 1}: Multiple accounts match "${accountName}": ${names}. Use the exact name.` }
          }
          const account = (picked as { match: { id: string; name: string } }).match

          const resolved: Record<string, unknown> = { ...item, account_id: account.id, account_display: account.name }

          if (typeof item.category_name === 'string' && item.category_name.trim()) {
            const catRes = await resolveCategoryRef(item.category_name, userId, supabase)
            if (!catRes.ok) return { ok: false, message: `Item ${i + 1}: ${catRes.message}` }
            resolved.category_id = catRes.category.id
            resolved.category_display = catRes.category.name
          }

          resolvedItems.push(resolved)
          const sign = item.cr_dr === 'credit' ? '+' : '-'
          const date = typeof item.date === 'string' ? item.date : todayInTz(tz)
          previewLines.push(`  ${i + 1}. ${sign}${fmt(item.amount_usd as number)} "${item.description}" on ${account.name} (${date})`)
        }

        const preview = `Log ${resolvedItems.length} transaction${resolvedItems.length > 1 ? 's' : ''}:\n${previewLines.join('\n')}`
        return { ok: true, resolvedInput: { items: resolvedItems }, preview }
      }

      case 'flag_transaction': {
        const txnRes = await resolveTransactionRef(input, userId, supabase)
        if (!txnRes.ok) return txnRes
        const t = txnRes.txn
        const sign = t.cr_dr === 'debit' ? '-' : '+'
        const action = input.flagged ? 'Flag' : 'Unflag'
        const reasonPart = input.flagged && typeof input.reason === 'string' && input.reason ? ` — reason: ${input.reason}` : ''
        const preview = `${action} "${t.description}" ${sign}${fmt(Math.abs(t.amount_usd ?? 0))} (${t.date})${reasonPart}`
        return { ok: true, resolvedInput: { ...input, transaction_id: t.id }, preview }
      }

      case 'update_transaction': {
        const hasChange =
          (typeof input.new_category_name === 'string' && input.new_category_name.trim()) ||
          (typeof input.new_description === 'string' && input.new_description.trim()) ||
          typeof input.new_notes === 'string'
        if (!hasChange) {
          return { ok: false, message: 'Nothing to update — provide new_category_name, new_description, or new_notes.' }
        }

        const txnRes = await resolveTransactionRef(input, userId, supabase)
        if (!txnRes.ok) return txnRes
        const t = txnRes.txn

        const resolved: Record<string, unknown> = { ...input, transaction_id: t.id }
        const changeParts: string[] = []
        if (typeof input.new_category_name === 'string' && input.new_category_name.trim()) {
          const catRes = await resolveCategoryRef(input.new_category_name, userId, supabase)
          if (!catRes.ok) return catRes
          resolved.category_id = catRes.category.id
          resolved.category_display = catRes.category.name
          changeParts.push(`category → ${catRes.category.name}`)
        }
        if (typeof input.new_description === 'string' && input.new_description.trim()) {
          changeParts.push(`description → "${input.new_description.trim()}"`)
        }
        if (typeof input.new_notes === 'string') changeParts.push('update notes')

        const sign = t.cr_dr === 'debit' ? '-' : '+'
        const preview = `Update "${t.description}" ${sign}${fmt(Math.abs(t.amount_usd ?? 0))} (${t.date}): ${changeParts.join('; ')}`
        return { ok: true, resolvedInput: resolved, preview }
      }

      case 'update_budget': {
        const categoryName = typeof input.category_name === 'string' ? input.category_name.trim() : ''
        if (!categoryName) return { ok: false, message: 'category_name is required.' }
        if (typeof input.amount_usd !== 'number' || input.amount_usd < 0) {
          return { ok: false, message: 'amount_usd must be a non-negative number.' }
        }
        const catRes = await resolveCategoryRef(categoryName, userId, supabase)
        if (!catRes.ok) return catRes

        const month = typeof input.month === 'string' ? input.month : monthStartInTz(tz)
        const monthLabel = new Date(`${month}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const preview = `Set ${catRes.category.name} budget to ${fmt(input.amount_usd as number)} for ${monthLabel}`
        return {
          ok: true,
          resolvedInput: { ...input, category_id: catRes.category.id, category_display: catRes.category.name, month },
          preview,
        }
      }

      case 'create_savings_goal': {
        const goalName = typeof input.name === 'string' ? input.name.trim() : ''
        if (!goalName) return { ok: false, message: 'name is required.' }
        if (typeof input.target_amount !== 'number' || input.target_amount <= 0) {
          return { ok: false, message: 'target_amount must be a positive number.' }
        }
        const { data: existing } = await supabase
          .from('savings_goals')
          .select('name, status')
          .eq('user_id', userId)
          .ilike('name', escapeIlike(goalName))
          .limit(1)
          .maybeSingle()
        if (existing && existing.status !== 'completed') {
          return {
            ok: false,
            message: `A savings goal named "${existing.name}" already exists (${existing.status}). Use update_savings_goal to modify it instead.`,
          }
        }
        const contributionPart = typeof input.monthly_contribution === 'number' && input.monthly_contribution > 0
          ? ` · ${fmt(input.monthly_contribution as number)}/month`
          : ''
        const preview = `Create savings goal "${goalName}" — target ${fmt(input.target_amount as number)}${contributionPart}`
        return { ok: true, resolvedInput: { ...input }, preview }
      }

      case 'update_savings_goal': {
        const goalName = typeof input.goal_name === 'string' ? input.goal_name.trim() : ''
        if (!goalName) return { ok: false, message: 'goal_name is required.' }

        const { data: rows } = await supabase
          .from('savings_goals')
          .select('id, name, current_amount, target_amount, status')
          .eq('user_id', userId)
          .ilike('name', like(goalName))
          .limit(6)

        const picked = pickByName(rows ?? [], goalName)
        if ('none' in picked) {
          const { data: all } = await supabase
            .from('savings_goals')
            .select('name')
            .eq('user_id', userId)
            .order('name')
            .limit(20)
          const available = (all ?? []).map((g) => `"${g.name}"`).join(', ')
          return { ok: false, message: `Savings goal "${goalName}" not found. Existing goals: ${available || 'none'}.` }
        }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((g) => `"${g.name}"`).join(', ')
          return { ok: false, message: `Multiple savings goals match "${goalName}": ${names}. Ask the user which one.` }
        }
        const goal = picked.match

        const changeParts: string[] = []
        if (typeof input.add_amount === 'number' && input.add_amount !== 0) {
          changeParts.push(`add ${fmt(input.add_amount)} (${fmt(goal.current_amount)} → ${fmt(goal.current_amount + input.add_amount)})`)
        }
        if (typeof input.monthly_contribution === 'number') changeParts.push(`monthly contribution → ${fmt(input.monthly_contribution as number)}`)
        if (typeof input.target_amount === 'number') changeParts.push(`target → ${fmt(input.target_amount as number)}`)
        if (typeof input.status === 'string') changeParts.push(`status → ${input.status}`)
        if (changeParts.length === 0) {
          return { ok: false, message: 'Nothing to update — provide add_amount, monthly_contribution, target_amount, or status.' }
        }

        const preview = `Update goal "${goal.name}": ${changeParts.join('; ')}`
        return { ok: true, resolvedInput: { ...input, goal_id: goal.id, goal_display: goal.name }, preview }
      }

      case 'update_subscription': {
        const subName = typeof input.subscription_name === 'string' ? input.subscription_name.trim() : ''
        if (!subName) return { ok: false, message: 'subscription_name is required.' }

        const { data: rows } = await supabase
          .from('subscriptions')
          .select('id, name, billing_cost, billing_cycle_months, status')
          .eq('user_id', userId)
          .ilike('name', like(subName))
          .limit(6)

        const picked = pickByName(rows ?? [], subName)
        if ('none' in picked) {
          const { data: all } = await supabase
            .from('subscriptions')
            .select('name, status')
            .eq('user_id', userId)
            .order('name')
            .limit(20)
          const available = (all ?? []).map((s) => `"${s.name}" (${s.status})`).join(', ')
          return { ok: false, message: `Subscription "${subName}" not found. Existing subscriptions: ${available || 'none'}.` }
        }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((s) => `"${s.name}" (${s.status})`).join(', ')
          return { ok: false, message: `Multiple subscriptions match "${subName}": ${names}. Ask the user which one.` }
        }
        const sub = picked.match

        const changeParts: string[] = []
        if (typeof input.status === 'string') changeParts.push(`status ${sub.status} → ${input.status}`)
        if (typeof input.billing_cost === 'number') changeParts.push(`cost ${fmt(sub.billing_cost)} → ${fmt(input.billing_cost as number)}`)
        if (typeof input.auto_renew === 'boolean') changeParts.push(`auto-renew → ${input.auto_renew ? 'on' : 'off'}`)
        if (changeParts.length === 0) {
          return { ok: false, message: 'Nothing to update — provide status, billing_cost, or auto_renew.' }
        }

        const preview = `Update subscription "${sub.name}" (${fmt(sub.billing_cost)}/${sub.billing_cycle_months === 1 ? 'mo' : `${sub.billing_cycle_months}mo`}): ${changeParts.join('; ')}`
        return { ok: true, resolvedInput: { ...input, subscription_id: sub.id, subscription_display: sub.name }, preview }
      }

      case 'transfer_funds': {
        const fromName = typeof input.from_account === 'string' ? input.from_account.trim() : ''
        const toName = typeof input.to_account === 'string' ? input.to_account.trim() : ''
        if (!fromName) return { ok: false, message: 'from_account is required.' }
        if (!toName) return { ok: false, message: 'to_account is required.' }
        if (typeof input.amount !== 'number' || input.amount <= 0) {
          return { ok: false, message: 'amount must be a positive number.' }
        }

        const [fromRes, toRes] = await Promise.all([
          supabase.from('accounts').select('id, name, currency').eq('user_id', userId).eq('is_active', true).ilike('name', like(fromName)).limit(6),
          supabase.from('accounts').select('id, name, currency').eq('user_id', userId).eq('is_active', true).ilike('name', like(toName)).limit(6),
        ])

        const fromPicked = pickByName(fromRes.data ?? [], fromName)
        if ('none' in fromPicked) {
          const { data: all } = await supabase.from('accounts').select('name').eq('user_id', userId).eq('is_active', true).limit(20)
          const available = (all ?? []).map((a) => a.name).join(', ')
          return { ok: false, message: `Source account "${fromName}" not found. Available accounts: ${available || 'none'}.` }
        }
        if ('ambiguous' in fromPicked) {
          const names = fromPicked.ambiguous.map((a) => `"${a.name}"`).join(', ')
          return { ok: false, message: `Multiple source accounts match "${fromName}": ${names}. Specify the exact name.` }
        }

        const toPicked = pickByName(toRes.data ?? [], toName)
        if ('none' in toPicked) {
          const { data: all } = await supabase.from('accounts').select('name').eq('user_id', userId).eq('is_active', true).limit(20)
          const available = (all ?? []).map((a) => a.name).join(', ')
          return { ok: false, message: `Destination account "${toName}" not found. Available accounts: ${available || 'none'}.` }
        }
        if ('ambiguous' in toPicked) {
          const names = toPicked.ambiguous.map((a) => `"${a.name}"`).join(', ')
          return { ok: false, message: `Multiple destination accounts match "${toName}": ${names}. Specify the exact name.` }
        }

        const fromAcct = fromPicked.match
        const toAcct = toPicked.match
        if (fromAcct.id === toAcct.id) {
          return { ok: false, message: 'Source and destination accounts must be different.' }
        }

        const date = typeof input.date === 'string' ? input.date : todayInTz(tz)
        const preview = `Transfer ${fmt(input.amount as number)} from ${fromAcct.name} → ${toAcct.name} on ${date}`
        return {
          ok: true,
          resolvedInput: {
            ...input,
            source_account_id: fromAcct.id,
            source_display: fromAcct.name,
            source_currency: fromAcct.currency ?? 'USD',
            target_account_id: toAcct.id,
            target_display: toAcct.name,
            target_currency: toAcct.currency ?? 'USD',
            date,
          },
          preview,
        }
      }

      case 'delete_transaction': {
        const txnRes = await resolveTransactionRef(input, userId, supabase)
        if (!txnRes.ok) return txnRes
        const t = txnRes.txn
        const sign = t.cr_dr === 'debit' ? '-' : '+'
        const preview = `Delete transaction: "${t.description}" ${sign}${fmt(Math.abs(t.amount_usd ?? 0))} on ${t.date}`
        return { ok: true, resolvedInput: { ...input, transaction_id: t.id }, preview }
      }

      case 'create_account': {
        const accountName = typeof input.name === 'string' ? input.name.trim() : ''
        if (!accountName) return { ok: false, message: 'name is required.' }
        if (!input.type) return { ok: false, message: 'type is required (checking, savings, credit_card, loan, investment, retirement).' }
        if (!input.kind) return { ok: false, message: 'kind is required (asset, liability, investment).' }

        const { data: existing } = await supabase
          .from('accounts').select('name').eq('user_id', userId).eq('is_active', true)
          .ilike('name', escapeIlike(accountName)).limit(1).maybeSingle()
        if (existing) {
          return { ok: false, message: `An active account named "${existing.name}" already exists. Use update_account to modify it.` }
        }

        const balance = typeof input.current_balance === 'number' ? input.current_balance : 0
        const currency = typeof input.currency === 'string' ? input.currency.toUpperCase() : 'USD'
        const preview = `Create ${input.kind}/${input.type} account: "${accountName}" (${currency}, balance ${fmt(balance)})`
        return { ok: true, resolvedInput: { ...input, name: accountName, currency }, preview }
      }

      case 'update_account': {
        const accountName = typeof input.account_name === 'string' ? input.account_name.trim() : ''
        if (!accountName) return { ok: false, message: 'account_name is required.' }

        const { data: rows } = await supabase
          .from('accounts').select('id, name, kind, type, current_balance, institution')
          .eq('user_id', userId).eq('is_active', true).ilike('name', like(accountName)).limit(6)

        const picked = pickByName(rows ?? [], accountName)
        if ('none' in picked) {
          const { data: all } = await supabase.from('accounts').select('name').eq('user_id', userId).eq('is_active', true).limit(20)
          const available = (all ?? []).map((a) => a.name).join(', ')
          return { ok: false, message: `Account "${accountName}" not found. Available accounts: ${available || 'none'}.` }
        }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((a) => `"${a.name}" (${a.kind}/${a.type})`).join(', ')
          return { ok: false, message: `Multiple accounts match "${accountName}": ${names}. Use the exact name.` }
        }
        const acct = picked.match

        const hasChange =
          (typeof input.new_name === 'string' && input.new_name.trim().length > 0) ||
          typeof input.institution === 'string' ||
          typeof input.current_balance === 'number' ||
          typeof input.notes === 'string'
        if (!hasChange) {
          return { ok: false, message: 'Nothing to update — provide new_name, institution, current_balance, or notes.' }
        }

        const changeParts: string[] = []
        if (typeof input.new_name === 'string' && input.new_name.trim()) changeParts.push(`name → "${input.new_name.trim()}"`)
        if (typeof input.institution === 'string') changeParts.push(`institution → "${input.institution}"`)
        if (typeof input.current_balance === 'number') changeParts.push(`balance → ${fmt(input.current_balance)}`)
        if (typeof input.notes === 'string') changeParts.push('update notes')

        const preview = `Update account "${acct.name}": ${changeParts.join('; ')}`
        return { ok: true, resolvedInput: { ...input, account_id: acct.id, account_display: acct.name }, preview }
      }

      case 'create_subscription': {
        const subName = typeof input.name === 'string' ? input.name.trim() : ''
        if (!subName) return { ok: false, message: 'name is required.' }
        if (typeof input.billing_cost !== 'number' || input.billing_cost < 0) {
          return { ok: false, message: 'billing_cost must be a non-negative number.' }
        }

        const { data: existing } = await supabase
          .from('subscriptions').select('name, status').eq('user_id', userId)
          .ilike('name', escapeIlike(subName)).limit(1).maybeSingle()
        if (existing && existing.status !== 'cancelled') {
          return { ok: false, message: `A subscription named "${existing.name}" already exists (${existing.status}). Use update_subscription to modify it.` }
        }

        const cycleMonths = typeof input.billing_cycle_months === 'number' ? input.billing_cycle_months : 1
        const cycleLabel = cycleMonths === 1 ? 'monthly' : cycleMonths === 12 ? 'annually' : `every ${cycleMonths} months`
        const preview = `Create subscription: "${subName}" — ${fmt(input.billing_cost as number)} ${cycleLabel}`
        return { ok: true, resolvedInput: { ...input, name: subName, billing_cycle_months: cycleMonths }, preview }
      }

      case 'delete_subscription': {
        const subName = typeof input.subscription_name === 'string' ? input.subscription_name.trim() : ''
        if (!subName) return { ok: false, message: 'subscription_name is required.' }

        const { data: rows } = await supabase
          .from('subscriptions').select('id, name, billing_cost, billing_cycle_months, status')
          .eq('user_id', userId).ilike('name', like(subName)).limit(6)

        const picked = pickByName(rows ?? [], subName)
        if ('none' in picked) return { ok: false, message: `Subscription "${subName}" not found.` }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((s) => `"${s.name}" (${s.status})`).join(', ')
          return { ok: false, message: `Multiple subscriptions match "${subName}": ${names}. Use the exact name.` }
        }
        const sub = picked.match
        const cycleLabel = sub.billing_cycle_months === 1 ? 'monthly' : `every ${sub.billing_cycle_months} months`
        const preview = `Delete subscription: "${sub.name}" (${fmt(sub.billing_cost)} ${cycleLabel})`
        return { ok: true, resolvedInput: { ...input, subscription_id: sub.id, subscription_display: sub.name }, preview }
      }

      case 'log_subscription_payment': {
        const subName = typeof input.subscription_name === 'string' ? input.subscription_name.trim() : ''
        if (!subName) return { ok: false, message: 'subscription_name is required.' }

        const { data: rows } = await supabase
          .from('subscriptions').select('id, name, billing_cost, billing_cycle_months, next_billing_date, status')
          .eq('user_id', userId).ilike('name', like(subName)).limit(6)

        const picked = pickByName(rows ?? [], subName)
        if ('none' in picked) return { ok: false, message: `Subscription "${subName}" not found.` }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((s) => `"${s.name}"`).join(', ')
          return { ok: false, message: `Multiple subscriptions match "${subName}": ${names}. Use the exact name.` }
        }
        const sub = picked.match

        const baseDate = sub.next_billing_date ? new Date(`${sub.next_billing_date}T12:00:00`) : new Date()
        const nextDate = new Date(baseDate)
        nextDate.setMonth(nextDate.getMonth() + (sub.billing_cycle_months || 1))
        const nextDateStr = nextDate.toISOString().split('T')[0]

        const preview = `Log payment for "${sub.name}" (${fmt(sub.billing_cost)}) — next billing advanced to ${nextDateStr}`
        return {
          ok: true,
          resolvedInput: { ...input, subscription_id: sub.id, subscription_display: sub.name, next_billing_date: nextDateStr },
          preview,
        }
      }

      case 'log_loan_payment': {
        const loanName = typeof input.loan_name === 'string' ? input.loan_name.trim() : ''
        if (!loanName) return { ok: false, message: 'loan_name is required.' }
        if (typeof input.payment_amount !== 'number' || input.payment_amount <= 0) {
          return { ok: false, message: 'payment_amount must be a positive number.' }
        }

        const { data: loanRows } = await supabase
          .from('loans').select('id, name, current_balance').eq('user_id', userId).ilike('name', like(loanName)).limit(6)

        const picked = pickByName(loanRows ?? [], loanName)
        if ('none' in picked) {
          const { data: all } = await supabase.from('loans').select('name').eq('user_id', userId).limit(20)
          const available = (all ?? []).map((l) => `"${l.name}"`).join(', ')
          return { ok: false, message: `Loan "${loanName}" not found. Existing loans: ${available || 'none'}.` }
        }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((l) => `"${l.name}"`).join(', ')
          return { ok: false, message: `Multiple loans match "${loanName}": ${names}. Use the exact name.` }
        }
        const loan = picked.match
        const newBalance = Math.max(0, loan.current_balance - (input.payment_amount as number))

        const resolved: Record<string, unknown> = {
          ...input,
          loan_id: loan.id,
          loan_display: loan.name,
          new_loan_balance: newBalance,
          date: typeof input.date === 'string' ? input.date : todayInTz(tz),
        }

        const fromAccountName = typeof input.from_account_name === 'string' ? input.from_account_name.trim() : ''
        if (fromAccountName) {
          const { data: acctRows } = await supabase
            .from('accounts').select('id, name').eq('user_id', userId).eq('is_active', true).ilike('name', like(fromAccountName)).limit(6)
          const acctPicked = pickByName(acctRows ?? [], fromAccountName)
          if ('none' in acctPicked) {
            return { ok: false, message: `Account "${fromAccountName}" not found. Omit from_account_name to skip creating a transaction.` }
          }
          if ('ambiguous' in acctPicked) {
            const names = acctPicked.ambiguous.map((a) => `"${a.name}"`).join(', ')
            return { ok: false, message: `Multiple accounts match "${fromAccountName}": ${names}. Use the exact name.` }
          }
          resolved.from_account_id = acctPicked.match.id
          resolved.from_account_display = acctPicked.match.name
        }

        const preview = `Log ${fmt(input.payment_amount as number)} payment on "${loan.name}" — balance ${fmt(loan.current_balance)} → ${fmt(newBalance)}${fromAccountName ? ` (debit from ${resolved.from_account_display})` : ''}`
        return { ok: true, resolvedInput: resolved, preview }
      }

      case 'delete_savings_goal': {
        const goalName = typeof input.goal_name === 'string' ? input.goal_name.trim() : ''
        if (!goalName) return { ok: false, message: 'goal_name is required.' }

        const { data: rows } = await supabase
          .from('savings_goals').select('id, name, current_amount, target_amount, status')
          .eq('user_id', userId).ilike('name', like(goalName)).limit(6)

        const picked = pickByName(rows ?? [], goalName)
        if ('none' in picked) {
          const { data: all } = await supabase.from('savings_goals').select('name').eq('user_id', userId).limit(20)
          const available = (all ?? []).map((g) => `"${g.name}"`).join(', ')
          return { ok: false, message: `Savings goal "${goalName}" not found. Existing goals: ${available || 'none'}.` }
        }
        if ('ambiguous' in picked) {
          const names = picked.ambiguous.map((g) => `"${g.name}"`).join(', ')
          return { ok: false, message: `Multiple savings goals match "${goalName}": ${names}. Use the exact name.` }
        }
        const goal = picked.match
        const preview = `Delete savings goal: "${goal.name}" (${fmt(goal.current_amount)} saved of ${fmt(goal.target_amount)} target)`
        return { ok: true, resolvedInput: { ...input, goal_id: goal.id, goal_display: goal.name }, preview }
      }

      case 'create_investment': {
        const ticker = typeof input.ticker === 'string' ? input.ticker.trim().toUpperCase() : ''
        const platform = typeof input.platform === 'string' ? input.platform.trim() : ''
        if (!ticker) return { ok: false, message: 'ticker is required.' }
        if (!platform) return { ok: false, message: 'platform is required.' }
        if (typeof input.total_invested !== 'number' || input.total_invested < 0) {
          return { ok: false, message: 'total_invested must be a non-negative number.' }
        }
        if (typeof input.current_value !== 'number' || input.current_value < 0) {
          return { ok: false, message: 'current_value must be a non-negative number.' }
        }

        const gl = (input.current_value as number) - (input.total_invested as number)
        const preview = `Create investment: ${ticker} on ${platform} — invested ${fmt(input.total_invested as number)}, current value ${fmt(input.current_value as number)} (${gl >= 0 ? '+' : ''}${fmt(gl)})`
        return { ok: true, resolvedInput: { ...input, ticker }, preview }
      }

      case 'update_investment': {
        const filter = typeof input.ticker_or_platform === 'string' ? input.ticker_or_platform.trim() : ''
        if (!filter) return { ok: false, message: 'ticker_or_platform is required.' }

        const { data: rows } = await supabase
          .from('investments').select('id, ticker, platform, total_invested, current_value')
          .eq('user_id', userId).or(`ticker.ilike.${like(filter)},platform.ilike.${like(filter)}`).limit(6)

        const investments = rows ?? []
        if (investments.length === 0) {
          return { ok: false, message: `No investment found matching "${filter}". Use get_investments to see all holdings.` }
        }
        if (investments.length > 1) {
          const lines = investments.map((i) => `  ${i.ticker || '—'} on ${i.platform} (${fmt(i.current_value)})`).join('\n')
          return { ok: false, message: `Multiple investments match "${filter}":\n${lines}\nBe more specific.` }
        }
        const inv = investments[0]

        const hasChange =
          typeof input.current_value === 'number' || typeof input.total_invested === 'number' || typeof input.notes === 'string'
        if (!hasChange) {
          return { ok: false, message: 'Nothing to update — provide current_value, total_invested, or notes.' }
        }

        const changeParts: string[] = []
        if (typeof input.current_value === 'number') changeParts.push(`value ${fmt(inv.current_value)} → ${fmt(input.current_value)}`)
        if (typeof input.total_invested === 'number') changeParts.push(`invested ${fmt(inv.total_invested)} → ${fmt(input.total_invested)}`)
        if (typeof input.notes === 'string') changeParts.push('update notes')

        const preview = `Update ${inv.ticker || inv.platform} on ${inv.platform}: ${changeParts.join('; ')}`
        return { ok: true, resolvedInput: { ...input, investment_id: inv.id, investment_display: `${inv.ticker} on ${inv.platform}` }, preview }
      }

      case 'delete_investment': {
        const filter = typeof input.ticker_or_platform === 'string' ? input.ticker_or_platform.trim() : ''
        if (!filter) return { ok: false, message: 'ticker_or_platform is required.' }

        const { data: rows } = await supabase
          .from('investments').select('id, ticker, platform, current_value')
          .eq('user_id', userId).or(`ticker.ilike.${like(filter)},platform.ilike.${like(filter)}`).limit(6)

        const investments = rows ?? []
        if (investments.length === 0) {
          return { ok: false, message: `No investment found matching "${filter}". Use get_investments to see all holdings.` }
        }
        if (investments.length > 1) {
          const lines = investments.map((i) => `  ${i.ticker || '—'} on ${i.platform} (${fmt(i.current_value)})`).join('\n')
          return { ok: false, message: `Multiple investments match "${filter}":\n${lines}\nBe more specific.` }
        }
        const inv = investments[0]
        const preview = `Delete investment: ${inv.ticker || '—'} on ${inv.platform} (current value ${fmt(inv.current_value)})`
        return { ok: true, resolvedInput: { ...input, investment_id: inv.id, investment_display: `${inv.ticker} on ${inv.platform}` }, preview }
      }

      case 'create_paycheck': {
        const employer = typeof input.employer === 'string' ? input.employer.trim() : ''
        if (!employer) return { ok: false, message: 'employer is required.' }
        if (typeof input.gross_pay !== 'number' || input.gross_pay <= 0) {
          return { ok: false, message: 'gross_pay must be a positive number.' }
        }
        if (typeof input.net_pay !== 'number' || input.net_pay < 0) {
          return { ok: false, message: 'net_pay must be a non-negative number.' }
        }
        if (!input.date) return { ok: false, message: 'date is required (YYYY-MM-DD).' }

        const resolved: Record<string, unknown> = { ...input }

        const depositAccountName = typeof input.deposit_account_name === 'string' ? input.deposit_account_name.trim() : ''
        if (depositAccountName) {
          const { data: acctRows } = await supabase
            .from('accounts').select('id, name').eq('user_id', userId).eq('is_active', true).ilike('name', like(depositAccountName)).limit(6)
          const picked = pickByName(acctRows ?? [], depositAccountName)
          if ('none' in picked) {
            return { ok: false, message: `Account "${depositAccountName}" not found. Omit deposit_account_name to skip creating a transaction.` }
          }
          if ('ambiguous' in picked) {
            const names = picked.ambiguous.map((a) => `"${a.name}"`).join(', ')
            return { ok: false, message: `Multiple accounts match "${depositAccountName}": ${names}. Use the exact name.` }
          }
          resolved.deposit_account_id = picked.match.id
          resolved.deposit_account_display = picked.match.name
        }

        const depositNote = depositAccountName ? ` + deposit ${fmt(input.net_pay as number)} to ${resolved.deposit_account_display}` : ''
        const preview = `Log paycheck from ${employer} on ${input.date}: gross ${fmt(input.gross_pay as number)} → net ${fmt(input.net_pay as number)}${depositNote}`
        return { ok: true, resolvedInput: resolved, preview }
      }

      case 'create_recurring_rule': {
        const description = typeof input.description === 'string' ? input.description.trim() : ''
        if (!description) return { ok: false, message: 'description is required.' }
        if (typeof input.amount_usd !== 'number' || input.amount_usd <= 0) {
          return { ok: false, message: 'amount_usd must be a positive number.' }
        }
        if (!input.cr_dr) return { ok: false, message: 'cr_dr is required (credit or debit).' }
        if (!input.frequency) return { ok: false, message: 'frequency is required.' }
        if (!input.next_due) return { ok: false, message: 'next_due (YYYY-MM-DD) is required.' }

        const accountName = typeof input.account_name === 'string' ? input.account_name.trim() : ''
        if (!accountName) return { ok: false, message: 'account_name is required.' }

        const { data: acctRows } = await supabase
          .from('accounts').select('id, name').eq('user_id', userId).eq('is_active', true).ilike('name', like(accountName)).limit(6)
        const acctPicked = pickByName(acctRows ?? [], accountName)
        if ('none' in acctPicked) {
          const { data: all } = await supabase.from('accounts').select('name').eq('user_id', userId).eq('is_active', true).limit(20)
          const available = (all ?? []).map((a) => a.name).join(', ')
          return { ok: false, message: `Account "${accountName}" not found. Available accounts: ${available || 'none'}.` }
        }
        if ('ambiguous' in acctPicked) {
          const names = acctPicked.ambiguous.map((a) => `"${a.name}"`).join(', ')
          return { ok: false, message: `Multiple accounts match "${accountName}": ${names}. Use the exact name.` }
        }

        const resolved: Record<string, unknown> = {
          ...input,
          account_id: acctPicked.match.id,
          account_display: acctPicked.match.name,
        }

        if (typeof input.category_name === 'string' && input.category_name.trim()) {
          const catRes = await resolveCategoryRef(input.category_name, userId, supabase)
          if (!catRes.ok) return catRes
          resolved.category_id = catRes.category.id
          resolved.category_display = catRes.category.name
        }

        const sign = input.cr_dr === 'credit' ? '+' : '-'
        const preview = `Create recurring rule: "${description}" ${sign}${fmt(input.amount_usd as number)} ${input.frequency} from ${acctPicked.match.name}, next due ${input.next_due}`
        return { ok: true, resolvedInput: resolved, preview }
      }

      case 'update_recurring_rule': {
        const ruleDesc = typeof input.rule_description === 'string' ? input.rule_description.trim() : ''
        if (!ruleDesc) return { ok: false, message: 'rule_description is required.' }

        const { data: rows } = await supabase
          .from('recurring_rules').select('id, description, amount_usd, cr_dr, frequency, next_due, is_active')
          .eq('user_id', userId).ilike('description', like(ruleDesc)).limit(6)

        const rules = rows ?? []
        if (rules.length === 0) {
          return { ok: false, message: `No recurring rule found matching "${ruleDesc}". Use get_recurring_rules to see all rules.` }
        }
        if (rules.length > 1) {
          const lines = rules.map((r) => `  "${r.description}" ${r.cr_dr} ${fmt(Math.abs(r.amount_usd))} ${r.frequency}`).join('\n')
          return { ok: false, message: `Multiple recurring rules match "${ruleDesc}":\n${lines}\nBe more specific.` }
        }
        const rule = rules[0]

        const hasChange =
          (typeof input.new_description === 'string' && input.new_description.trim().length > 0) ||
          typeof input.amount_usd === 'number' ||
          typeof input.frequency === 'string' ||
          typeof input.next_due === 'string' ||
          typeof input.is_active === 'boolean' ||
          (typeof input.category_name === 'string' && input.category_name.trim().length > 0)
        if (!hasChange) {
          return { ok: false, message: 'Nothing to update — provide new_description, amount_usd, frequency, next_due, is_active, or category_name.' }
        }

        const resolved: Record<string, unknown> = { ...input, rule_id: rule.id, rule_display: rule.description }

        if (typeof input.category_name === 'string' && input.category_name.trim()) {
          const catRes = await resolveCategoryRef(input.category_name, userId, supabase)
          if (!catRes.ok) return catRes
          resolved.category_id = catRes.category.id
          resolved.category_display = catRes.category.name
        }

        const changeParts: string[] = []
        if (typeof input.new_description === 'string' && input.new_description.trim()) changeParts.push(`description → "${input.new_description.trim()}"`)
        if (typeof input.amount_usd === 'number') changeParts.push(`amount ${fmt(Math.abs(rule.amount_usd))} → ${fmt(input.amount_usd)}`)
        if (typeof input.frequency === 'string') changeParts.push(`frequency → ${input.frequency}`)
        if (typeof input.next_due === 'string') changeParts.push(`next due → ${input.next_due}`)
        if (typeof input.is_active === 'boolean') changeParts.push(input.is_active ? 'activate' : 'pause')
        if (resolved.category_display) changeParts.push(`category → ${resolved.category_display}`)

        const preview = `Update recurring rule "${rule.description}": ${changeParts.join('; ')}`
        return { ok: true, resolvedInput: resolved, preview }
      }

      case 'delete_recurring_rule': {
        const ruleDesc = typeof input.rule_description === 'string' ? input.rule_description.trim() : ''
        if (!ruleDesc) return { ok: false, message: 'rule_description is required.' }

        const { data: rows } = await supabase
          .from('recurring_rules').select('id, description, amount_usd, cr_dr, frequency')
          .eq('user_id', userId).ilike('description', like(ruleDesc)).limit(6)

        const rules = rows ?? []
        if (rules.length === 0) {
          return { ok: false, message: `No recurring rule found matching "${ruleDesc}". Use get_recurring_rules to see all rules.` }
        }
        if (rules.length > 1) {
          const lines = rules.map((r) => `  "${r.description}" ${r.cr_dr} ${fmt(Math.abs(r.amount_usd))} ${r.frequency}`).join('\n')
          return { ok: false, message: `Multiple recurring rules match "${ruleDesc}":\n${lines}\nBe more specific.` }
        }
        const rule = rules[0]
        const sign = rule.cr_dr === 'debit' ? '-' : '+'
        const preview = `Delete recurring rule: "${rule.description}" ${sign}${fmt(Math.abs(rule.amount_usd))} ${rule.frequency}`
        return { ok: true, resolvedInput: { ...input, rule_id: rule.id, rule_display: rule.description }, preview }
      }

      default:
        return { ok: false, message: `Unknown write tool "${name}".` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, message: `Failed to resolve action: ${msg}` }
  }
}
