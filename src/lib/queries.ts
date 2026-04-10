// Convenience hooks for common data patterns
import { supabase } from './supabase'
import type { Transaction, Account, Budget, Category } from './types'

export async function getDashboardSummary(userId: string) {
  const [accounts, recentTxns, budgets, insights] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('transactions')
      .select('*, account:accounts(*), category:categories(*)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(10),
    supabase.from('budgets').select('*, category:categories(*)').eq('user_id', userId),
    supabase.from('ai_insights').select('*').eq('user_id', userId).eq('is_read', false).order('created_at', { ascending: false }).limit(1),
  ])

  return {
    accounts: accounts.data ?? [],
    recentTxns: recentTxns.data ?? [],
    budgets: budgets.data ?? [],
    latestInsight: insights.data?.[0] ?? null,
  }
}

export async function getTransactions(userId: string, filters?: {
  accountId?: string
  categoryId?: string
  startDate?: string
  endDate?: string
  search?: string
  limit?: number
  offset?: number
}) {
  let query = supabase
    .from('transactions')
    .select('*, account:accounts(*), category:categories(*)')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (filters?.accountId) query = query.eq('account_id', filters.accountId)
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters?.startDate) query = query.gte('date', filters.startDate)
  if (filters?.endDate) query = query.lte('date', filters.endDate)
  if (filters?.search) query = query.ilike('description', `%${filters.search}%`)
  if (filters?.limit) query = query.limit(filters.limit)
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 20) - 1)

  return query
}

export async function getAccounts(userId: string) {
  return supabase.from('accounts').select('*').eq('user_id', userId).eq('is_active', true).order('name')
}

export async function getCategories(userId: string) {
  return supabase.from('categories').select('*').eq('user_id', userId).order('name')
}

export async function getBudgets(userId: string, month?: string) {
  const date = month ?? new Date().toISOString().split('T')[0].slice(0, 7) + '-01'
  return supabase
    .from('budgets')
    .select('*, category:categories(*)')
    .eq('user_id', userId)
    .eq('month', date)
}
