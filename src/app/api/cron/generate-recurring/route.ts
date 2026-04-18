import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * GET /api/cron/generate-recurring
 * Runs daily. Finds recurring rules where next_due <= today, creates
 * transactions, and advances next_due to the following period.
 *
 * Authorize with: Authorization: Bearer <CRON_SECRET>
 * or header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const auth =
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    request.headers.get('x-cron-secret') ??
    ''
  if (auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use service-role client — cron jobs have no user session, so the anon
    // client would yield zero rows from RLS-protected tables.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const today = new Date().toISOString().split('T')[0]

    // Find all active rules that are due
    const { data: rules, error: rulesErr } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('is_active', true)
      .lte('next_due', today)

    if (rulesErr) {
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
    }

    const results: { ruleId: string; created: boolean; error?: string }[] = []

    for (const rule of rules ?? []) {
      // Check if a transaction for this rule was already created today (idempotency)
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', rule.user_id)
        .eq('recurring_rule_id', rule.id)
        .eq('date', rule.next_due)
        .limit(1)

      if (existing && existing.length > 0) {
        results.push({ ruleId: rule.id, created: false })
        continue
      }

      // ── Self-transfer rule: create paired debit + credit ────────────────────
      if (rule.target_account_id && rule.target_account_id !== rule.account_id) {
        const transferGroupId = randomUUID()

        // Find Transfer category
        let transferCategoryId: string | null = null
        const { data: transferCat } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', rule.user_id)
          .eq('name', 'Transfer')
          .single()
        transferCategoryId = transferCat?.id ?? null

        const { data: txnA, error: errA } = await supabase
          .from('transactions')
          .insert({
            user_id: rule.user_id,
            account_id: rule.account_id,
            category_id: transferCategoryId,
            description: rule.description,
            amount_usd: -rule.amount_usd,
            final_amount: -rule.amount_usd,
            amount_original: rule.amount_usd,
            original_currency: 'USD',
            cr_dr: 'debit',
            date: rule.next_due,
            notes: rule.notes ?? null,
            source: 'manual',
            import_status: 'confirmed',
            is_recurring: true,
            recurring_rule_id: rule.id,
            flagged: false,
            ai_categorized: false,
            is_internal_transfer: true,
            transfer_group_id: transferGroupId,
          })
          .select()
          .single()

        if (errA || !txnA) {
          results.push({ ruleId: rule.id, created: false, error: errA?.message ?? 'Transfer debit failed' })
          continue
        }

        const { data: txnB, error: errB } = await supabase
          .from('transactions')
          .insert({
            user_id: rule.user_id,
            account_id: rule.target_account_id,
            category_id: transferCategoryId,
            description: rule.description,
            amount_usd: rule.amount_usd,
            final_amount: rule.amount_usd,
            amount_original: rule.amount_usd,
            original_currency: 'USD',
            cr_dr: 'credit',
            date: rule.next_due,
            notes: rule.notes ?? null,
            source: 'manual',
            import_status: 'confirmed',
            is_recurring: true,
            recurring_rule_id: rule.id,
            flagged: false,
            ai_categorized: false,
            is_internal_transfer: true,
            transfer_group_id: transferGroupId,
            linked_transaction_id: txnA.id,
          })
          .select()
          .single()

        if (errB) {
          await supabase.from('transactions').delete().eq('id', txnA.id)
          results.push({ ruleId: rule.id, created: false, error: errB.message })
          continue
        }

        // Cross-link
        await supabase.from('transactions').update({ linked_transaction_id: txnB!.id }).eq('id', txnA.id)

        // Update both account balances atomically — avoids read-modify-write race condition
        await Promise.all([
          supabase.rpc('increment_account_balance', { p_account_id: rule.account_id, p_delta: -rule.amount_usd }),
          supabase.rpc('increment_account_balance', { p_account_id: rule.target_account_id, p_delta: rule.amount_usd }),
        ])

        const nextDue = advanceDate(rule.next_due, rule.frequency, rule.day_of_month)
        await supabase.from('recurring_rules').update({ next_due: nextDue }).eq('id', rule.id)
        results.push({ ruleId: rule.id, created: true })
        continue
      }

      // ── Standard recurring transaction ───────────────────────────────────────
      const finalAmount = rule.cr_dr === 'credit' ? rule.amount_usd : -rule.amount_usd

      const { error: insertErr } = await supabase.from('transactions').insert({
        user_id: rule.user_id,
        account_id: rule.account_id,
        category_id: rule.category_id ?? null,
        description: rule.description,
        amount_usd: finalAmount,
        final_amount: finalAmount,
        amount_original: rule.amount_usd,
        original_currency: 'USD',
        cr_dr: rule.cr_dr,
        date: rule.next_due,
        notes: rule.notes ?? null,
        source: 'manual',
        import_status: 'confirmed',
        is_recurring: true,
        recurring_rule_id: rule.id,
        flagged: false,
        ai_categorized: false,
        is_internal_transfer: false,
      })

      if (insertErr) {
        results.push({ ruleId: rule.id, created: false, error: insertErr.message })
        continue
      }

      // Update account balance atomically — avoids read-modify-write race condition
      const delta = rule.cr_dr === 'credit' ? rule.amount_usd : -rule.amount_usd
      await supabase.rpc('increment_account_balance', { p_account_id: rule.account_id, p_delta: delta })

      // Advance next_due
      const nextDue = advanceDate(rule.next_due, rule.frequency, rule.day_of_month)
      await supabase
        .from('recurring_rules')
        .update({ next_due: nextDue })
        .eq('id', rule.id)

      results.push({ ruleId: rule.id, created: true })
    }

    const created = results.filter(r => r.created).length
    return NextResponse.json({ processed: results.length, created, results })
  } catch (err) {
    console.error('Generate recurring error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function advanceDate(dateStr: string, frequency: string, dayOfMonth?: number | null): string {
  const d = new Date(dateStr + 'T00:00:00')

  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14)
      break
    case 'monthly': {
      d.setMonth(d.getMonth() + 1)
      if (dayOfMonth) {
        // Clamp to last day of month
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(dayOfMonth, lastDay))
      }
      break
    }
    case 'quarterly':
      d.setMonth(d.getMonth() + 3)
      break
    case 'annually':
      d.setFullYear(d.getFullYear() + 1)
      break
    default:
      d.setMonth(d.getMonth() + 1)
  }

  return d.toISOString().split('T')[0]
}
