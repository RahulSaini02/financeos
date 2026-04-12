import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

async function adjustAccountBalance(supabase: SupabaseClient, accountId: string, delta: number) {
  const { data: acct } = await supabase
    .from('accounts')
    .select('current_balance')
    .eq('id', accountId)
    .single()
  if (acct) {
    await supabase
      .from('accounts')
      .update({ current_balance: (acct.current_balance ?? 0) + delta })
      .eq('id', accountId)
  }
}

async function adjustLoanBalance(supabase: SupabaseClient, loanId: string, delta: number) {
  const { data: loan } = await supabase
    .from('loans')
    .select('current_balance')
    .eq('id', loanId)
    .single()
  if (loan) {
    await supabase
      .from('loans')
      .update({ current_balance: Math.max(0, (loan.current_balance ?? 0) + delta) })
      .eq('id', loanId)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Capture original before update (include transfer fields)
    const { data: original } = await supabase
      .from('transactions')
      .select('amount_usd, account_id, loan_id, cr_dr, is_internal_transfer, linked_transaction_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    // Normalize amount_usd to signed when amount fields are provided
    const { amount_usd, cr_dr, ...rest } = body
    const updatePayload: Record<string, unknown> = { ...rest }

    if (amount_usd != null) {
      const rawAmt = Math.abs(Number(amount_usd))
      const direction = cr_dr ?? original?.cr_dr ?? 'debit'
      const signedAmt = direction === 'credit' ? rawAmt : -rawAmt
      updatePayload.amount_usd = signedAmt
      updatePayload.final_amount = signedAmt
      updatePayload.amount_original = rawAmt
      if (cr_dr != null) updatePayload.cr_dr = cr_dr
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Transaction update error:', error)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // ── Account balance sync ────────────────────────────────────────────────
    if (original) {
      try {
        const oldAmt = original.amount_usd ?? 0
        const newAmt = data.amount_usd ?? 0
        const oldAccId = original.account_id
        const newAccId = data.account_id

        if (oldAccId === newAccId && oldAccId && oldAmt !== newAmt) {
          await adjustAccountBalance(supabase, oldAccId, newAmt - oldAmt)
        } else if (oldAccId !== newAccId) {
          if (oldAccId) await adjustAccountBalance(supabase, oldAccId, -oldAmt)
          if (newAccId) await adjustAccountBalance(supabase, newAccId, newAmt)
        }
      } catch { /* non-fatal */ }
    }

    // ── If this is a transfer, cascade amount change to the linked leg ──────
    if (original?.is_internal_transfer && original.linked_transaction_id && amount_usd != null) {
      try {
        const oldAmt = original.amount_usd ?? 0
        const newAmt = data.amount_usd ?? 0
        const amtDelta = newAmt - oldAmt

        // Fetch the linked transaction
        const { data: linked } = await supabase
          .from('transactions')
          .select('id, amount_usd, account_id, cr_dr')
          .eq('id', original.linked_transaction_id)
          .eq('user_id', user.id)
          .single()

        if (linked) {
          // The linked leg is the opposite direction: its sign is the mirror
          const linkedNewAmt = linked.cr_dr === 'credit'
            ? Math.abs(newAmt)
            : -Math.abs(newAmt)
          const linkedDelta = linkedNewAmt - (linked.amount_usd ?? 0)

          await supabase
            .from('transactions')
            .update({
              amount_usd: linkedNewAmt,
              final_amount: linkedNewAmt,
              amount_original: Math.abs(newAmt),
            })
            .eq('id', linked.id)

          if (linked.account_id && linkedDelta !== 0) {
            await adjustAccountBalance(supabase, linked.account_id, linkedDelta)
          }
        }

        // Suppress unused variable warning
        void amtDelta
      } catch (e) {
        console.warn('Transfer linked-leg update failed (non-fatal):', e)
      }
    }

    // ── Loan balance sync ────────────────────────────────────────────────────
    if (original) {
      try {
        const oldLoanId = original.loan_id ?? null
        const newLoanId = 'loan_id' in updatePayload ? (updatePayload.loan_id as string | null ?? null) : oldLoanId
        const oldAmt = original.amount_usd ?? 0
        const newAmt = data.amount_usd ?? 0

        if (oldLoanId !== newLoanId) {
          if (oldLoanId) await adjustLoanBalance(supabase, oldLoanId, -oldAmt)
          if (newLoanId) await adjustLoanBalance(supabase, newLoanId, newAmt)
        } else if (newLoanId && oldAmt !== newAmt) {
          await adjustLoanBalance(supabase, newLoanId, newAmt - oldAmt)
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Transaction PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch before delete to reverse balance effects (include transfer fields)
    const { data: existing, error: fetchError } = await supabase
      .from('transactions')
      .select('id, amount_usd, account_id, loan_id, is_internal_transfer, linked_transaction_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // ── For transfers: also delete the linked leg and reverse its balance ───
    let linkedTxn: { id: string; amount_usd: number | null; account_id: string | null } | null = null

    if (existing.is_internal_transfer && existing.linked_transaction_id) {
      const { data: linked } = await supabase
        .from('transactions')
        .select('id, amount_usd, account_id')
        .eq('id', existing.linked_transaction_id)
        .eq('user_id', user.id)
        .single()
      if (linked) linkedTxn = linked
    }

    // Delete this transaction
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Transaction delete error:', error)
      return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
    }

    // Reverse this transaction's account balance
    if (existing.account_id) {
      try {
        await adjustAccountBalance(supabase, existing.account_id, -(existing.amount_usd ?? 0))
      } catch { /* non-fatal */ }
    }

    // Reverse loan balance
    if (existing.loan_id) {
      try {
        await adjustLoanBalance(supabase, existing.loan_id, -(existing.amount_usd ?? 0))
      } catch { /* non-fatal */ }
    }

    // ── Delete linked transfer leg + reverse its account balance ────────────
    if (linkedTxn) {
      try {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', linkedTxn.id)
          .eq('user_id', user.id)

        if (linkedTxn.account_id) {
          await adjustAccountBalance(supabase, linkedTxn.account_id, -(linkedTxn.amount_usd ?? 0))
        }
      } catch (e) {
        console.warn('Linked transfer leg delete failed (non-fatal):', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Transaction DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
