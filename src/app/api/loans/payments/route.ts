import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { loan_id, payment_date, emi_paid, interest, principal_paid, closing_balance, from_account_id } = body

    if (!loan_id || !payment_date || emi_paid == null) {
      return NextResponse.json({ error: 'loan_id, payment_date, and emi_paid are required' }, { status: 400 })
    }

    // Verify loan belongs to user
    const { data: loan, error: loanErr } = await supabase
      .from('loans')
      .select('id, name, current_balance, account_id')
      .eq('id', loan_id)
      .eq('user_id', user.id)
      .single()

    if (loanErr || !loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    const opening_balance = loan.current_balance
    const calcInterest = interest ?? 0
    const calcPrincipal = principal_paid ?? Math.max(emi_paid - calcInterest, 0)
    const calcClosing = closing_balance ?? Math.max(opening_balance - calcPrincipal, 0)

    // Insert payment record
    const { data: payment, error: paymentErr } = await supabase
      .from('loan_payments')
      .insert({
        loan_id,
        payment_date,
        opening_balance,
        emi_paid,
        interest: calcInterest,
        principal_paid: calcPrincipal,
        closing_balance: calcClosing,
      })
      .select()
      .single()

    if (paymentErr) {
      console.error('Loan payment insert error:', paymentErr)
      return NextResponse.json({ error: 'Failed to log payment' }, { status: 500 })
    }

    // Update loan's current_balance
    const { error: updateErr } = await supabase
      .from('loans')
      .update({ current_balance: calcClosing })
      .eq('id', loan_id)

    if (updateErr) {
      console.error('Loan balance update error:', updateErr)
    }

    // Auto-create a debit transaction on the "pay from" account
    if (from_account_id) {
      try {
        const signedAmt = -Math.abs(emi_paid) // debit = negative
        const { error: txnInsertErr } = await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: from_account_id,
          loan_id: loan_id,
          description: `Loan Payment — ${loan.name}`,
          amount_usd: signedAmt,
          amount_original: Math.abs(emi_paid),
          cr_dr: 'debit',
          date: payment_date,
          source: 'manual',
          import_status: 'confirmed',
          flagged: false,
          is_recurring: false,
          ai_categorized: false,
          is_internal_transfer: false,
        })
        if (txnInsertErr) {
          console.error('Loan payment transaction insert error:', txnInsertErr)
        }

        // Reduce the paying account's balance
        const { data: acct } = await supabase
          .from('accounts')
          .select('current_balance')
          .eq('id', from_account_id)
          .eq('user_id', user.id) // verify account belongs to user
          .single()
        if (acct) {
          await supabase
            .from('accounts')
            .update({ current_balance: (acct.current_balance ?? 0) + signedAmt })
            .eq('id', from_account_id)
            .eq('user_id', user.id)
        }
      } catch (txnErr) {
        console.warn('Auto-transaction creation failed (non-fatal):', txnErr)
      }
    }

    return NextResponse.json({ payment, new_balance: calcClosing }, { status: 201 })
  } catch (err) {
    console.error('Loan payment POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
