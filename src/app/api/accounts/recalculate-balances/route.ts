import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/accounts/recalculate-balances
 *
 * Recalculates current_balance for one or all accounts belonging to the user.
 * Balance = opening_balance + SUM(amount_usd) across all confirmed transactions.
 *
 * Body (optional):
 *   { account_id: string }  — recalculate just this account
 *   {}                      — recalculate all active accounts for the user
 *
 * Returns: { updated: number, results: { id, name, old_balance, new_balance }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { account_id } = body as { account_id?: string }

    // Fetch accounts to recalculate
    let accountQuery = supabase
      .from('accounts')
      .select('id, name, opening_balance, current_balance')
      .eq('user_id', user.id)

    if (account_id) {
      accountQuery = accountQuery.eq('id', account_id)
    }

    const { data: accounts, error: acctErr } = await accountQuery
    if (acctErr || !accounts) {
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    if (accounts.length === 0) {
      return NextResponse.json({ error: 'No accounts found' }, { status: 404 })
    }

    const results: { id: string; name: string; old_balance: number; new_balance: number }[] = []

    for (const acct of accounts) {
      // Sum all amount_usd values for this account (amount_usd is signed)
      const { data: txnSumData, error: txnErr } = await supabase
        .from('transactions')
        .select('amount_usd')
        .eq('user_id', user.id)
        .eq('account_id', acct.id)

      if (txnErr) {
        console.error(`Failed to fetch transactions for account ${acct.id}:`, txnErr)
        continue
      }

      const txnSum = (txnSumData ?? []).reduce(
        (sum, row) => sum + (row.amount_usd ?? 0),
        0
      )

      const newBalance = (acct.opening_balance ?? 0) + txnSum

      const { error: updateErr } = await supabase
        .from('accounts')
        .update({ current_balance: newBalance })
        .eq('id', acct.id)
        .eq('user_id', user.id)

      if (updateErr) {
        console.error(`Failed to update balance for account ${acct.id}:`, updateErr)
        continue
      }

      results.push({
        id: acct.id,
        name: acct.name,
        old_balance: acct.current_balance ?? 0,
        new_balance: newBalance,
      })
    }

    return NextResponse.json({ updated: results.length, results })
  } catch (err) {
    console.error('Recalculate balances error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
