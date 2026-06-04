import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'

// Service-role client — bypasses RLS for account balance updates.
// Only used AFTER user identity has been verified via the user-scoped client.
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

// ── 401k employer match calculation ─────────────────────────────────────────
// Based on a common 3% full + 50% of next 2% match structure.
function calcEmployerMatch(grossPay: number, employeePct: number): number {
  const base = Math.min(employeePct, 3)
  const extra = Math.max(employeePct - 3, 0)
  return grossPay * (base / 100) + grossPay * (extra / 100) * 0.5
}

// ── POST — Create paycheck ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      account_id,
      employer,
      employer_id,
      date,
      gross_pay,
      federal_tax,
      state_tax,
      sdi,
      other_deductions,
      retirement_401k,
      employer_401k_match,
      employee_401k_pct,
      net_pay,
      notes,
    } = body

    // Basic validation
    if (!employer || !date || net_pay == null || gross_pay == null) {
      return NextResponse.json(
        { error: 'Missing required fields: employer, date, gross_pay, net_pay' },
        { status: 400 },
      )
    }

    // Insert paycheck row (user-scoped client — RLS is satisfied on server)
    const { data: paycheck, error: insertErr } = await supabase
      .from('paychecks')
      .insert({
        user_id: user.id,
        account_id: account_id ?? null,
        employer,
        employer_id: employer_id ?? null,
        date,
        gross_pay,
        federal_tax: federal_tax ?? 0,
        state_tax: state_tax ?? 0,
        sdi: sdi ?? 0,
        other_deductions: other_deductions ?? 0,
        retirement_401k: retirement_401k ?? 0,
        employer_401k_match: employer_401k_match ?? 0,
        employee_401k_pct: employee_401k_pct ?? 0,
        net_pay,
        notes: notes ?? null,
        transaction_id: null,
      })
      .select()
      .single()

    if (insertErr || !paycheck) {
      console.error('Paycheck insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create paycheck' }, { status: 500 })
    }

    // ── Step 3: Create linked credit transaction via /api/transactions ────────
    if (account_id && net_pay > 0) {
      try {
        const txnUrl = new URL('/api/transactions', request.url)
        const txnRes = await fetch(txnUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({
            account_id,
            description: `Paycheck — ${employer}`,
            amount_usd: net_pay,
            cr_dr: 'credit',
            date,
            notes: `Auto-generated from paycheck. Gross: $${gross_pay}`,
          }),
        })

        if (txnRes.ok) {
          const txnData = await txnRes.json()
          if (txnData?.id) {
            // Link transaction back to paycheck
            const { error: linkErr } = await supabase
              .from('paychecks')
              .update({ transaction_id: txnData.id })
              .eq('id', paycheck.id)
            if (linkErr) {
              console.error('Paycheck transaction_id link error:', linkErr)
            } else {
              paycheck.transaction_id = txnData.id
            }
          }
        } else {
          console.error('Paycheck transaction creation failed:', await txnRes.text())
        }
      } catch (txnErr) {
        // Non-fatal: paycheck was created; transaction sync failed
        console.error('Paycheck transaction creation error:', txnErr)
      }
    }

    // ── Step 4: Sync 401k investment if retirement contributions exist ─────────
    const contrib401k = retirement_401k ?? 0
    const empPct = employee_401k_pct ?? 0
    if (contrib401k > 0) {
      try {
        const adminClient = createAdminClient()
        const employerMatch = calcEmployerMatch(gross_pay, empPct)
        const total401k = contrib401k + employerMatch

        const { data: investments } = await adminClient
          .from('investments')
          .select('id, total_invested, current_value')
          .eq('user_id', user.id)
          .ilike('type', '%401%')
          .limit(1)

        if (investments && investments.length > 0) {
          const inv = investments[0]
          await adminClient
            .from('investments')
            .update({
              total_invested: (inv.total_invested ?? 0) + total401k,
              current_value: (inv.current_value ?? 0) + total401k,
            })
            .eq('id', inv.id)
        }
      } catch (invErr) {
        // Non-fatal
        console.error('Paycheck 401k sync error:', invErr)
      }
    }

    return NextResponse.json(paycheck, { status: 201 })
  } catch (err) {
    console.error('Paychecks POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PUT — Update paycheck ────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...payload } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing paycheck id' }, { status: 400 })
    }

    // Fetch existing paycheck to compute deltas
    const { data: existing, error: fetchErr } = await supabase
      .from('paychecks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Paycheck not found' }, { status: 404 })
    }

    // Determine new values (fall back to existing if not provided in payload)
    const newNetPay: number = payload.net_pay ?? existing.net_pay
    const newGrossPay: number = payload.gross_pay ?? existing.gross_pay
    const newDate: string = payload.date ?? existing.date
    const newEmployer: string = payload.employer ?? existing.employer
    const newAccountId: string | null = payload.account_id ?? existing.account_id

    // Update paycheck row
    const { data: updated, error: updateErr } = await supabase
      .from('paychecks')
      .update({
        ...payload,
        // Ensure user_id cannot be overwritten by the payload
        user_id: user.id,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateErr || !updated) {
      console.error('Paycheck update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update paycheck' }, { status: 500 })
    }

    // ── Update linked transaction fields if one exists ─────────────────────
    if (existing.transaction_id) {
      const { error: txnUpdateErr } = await supabase
        .from('transactions')
        .update({
          amount_usd: newNetPay,
          final_amount: newNetPay,
          amount_original: newNetPay,
          description: `Paycheck — ${newEmployer}`,
          date: newDate,
          account_id: newAccountId,
          notes: `Auto-generated from paycheck. Gross: $${newGrossPay}`,
        })
        .eq('id', existing.transaction_id)
        .eq('user_id', user.id)

      if (txnUpdateErr) {
        console.error('Paycheck linked transaction update error:', txnUpdateErr)
        // Non-fatal: paycheck row was updated, warn but continue
      }
    }

    // ── Adjust account balance by net_pay delta ────────────────────────────
    const netPayDelta = newNetPay - existing.net_pay
    if (netPayDelta !== 0 && newAccountId) {
      try {
        const adminClient = createAdminClient()
        const { data: acct } = await adminClient
          .from('accounts')
          .select('current_balance')
          .eq('id', newAccountId)
          .single()
        if (acct) {
          await adminClient
            .from('accounts')
            .update({ current_balance: (acct.current_balance ?? 0) + netPayDelta })
            .eq('id', newAccountId)
        }
      } catch (balErr) {
        console.error('Paycheck balance delta update error:', balErr)
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Paychecks PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE — Delete paycheck ─────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing paycheck id' }, { status: 400 })
    }

    // Fetch paycheck to retrieve linked data before deleting
    const { data: paycheck, error: fetchErr } = await supabase
      .from('paychecks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !paycheck) {
      return NextResponse.json({ error: 'Paycheck not found' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // ── Step 3: Reverse account balance + delete linked transaction ───────────
    if (paycheck.transaction_id) {
      // Reverse account balance: subtract net_pay from the account
      if (paycheck.account_id && paycheck.net_pay > 0) {
        try {
          const { data: acct } = await adminClient
            .from('accounts')
            .select('current_balance')
            .eq('id', paycheck.account_id)
            .single()
          if (acct) {
            await adminClient
              .from('accounts')
              .update({ current_balance: (acct.current_balance ?? 0) - paycheck.net_pay })
              .eq('id', paycheck.account_id)
          }
        } catch (balErr) {
          console.error('Paycheck delete balance reversal error:', balErr)
        }
      }

      // Delete the linked transaction
      const { error: txnDelErr } = await supabase
        .from('transactions')
        .delete()
        .eq('id', paycheck.transaction_id)
        .eq('user_id', user.id)

      if (txnDelErr) {
        console.error('Paycheck linked transaction delete error:', txnDelErr)
        // Non-fatal: proceed with paycheck deletion
      }
    }

    // ── Step 4: Reverse 401k investment contribution ──────────────────────────
    const contrib401k: number = paycheck.retirement_401k ?? 0
    const empPct: number = paycheck.employee_401k_pct ?? 0
    if (contrib401k > 0) {
      try {
        const employerMatch = calcEmployerMatch(paycheck.gross_pay, empPct)
        const total401k = contrib401k + employerMatch

        const { data: investments } = await adminClient
          .from('investments')
          .select('id, total_invested, current_value')
          .eq('user_id', user.id)
          .ilike('type', '%401%')
          .limit(1)

        if (investments && investments.length > 0) {
          const inv = investments[0]
          await adminClient
            .from('investments')
            .update({
              total_invested: Math.max(0, (inv.total_invested ?? 0) - total401k),
              current_value: Math.max(0, (inv.current_value ?? 0) - total401k),
            })
            .eq('id', inv.id)
        }
      } catch (invErr) {
        // Non-fatal
        console.error('Paycheck delete 401k reversal error:', invErr)
      }
    }

    // ── Step 5: Delete the paycheck ───────────────────────────────────────────
    const { error: delErr } = await supabase
      .from('paychecks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (delErr) {
      console.error('Paycheck delete error:', delErr)
      return NextResponse.json({ error: 'Failed to delete paycheck' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Paycheck deleted' })
  } catch (err) {
    console.error('Paychecks DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
