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

      default:
        return { ok: false, message: `Unknown write tool "${name}".` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, message: `Failed to resolve action: ${msg}` }
  }
}
