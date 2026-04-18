import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserModel } from '@/lib/get-user-model'
import { randomUUID } from 'crypto'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const accountId = searchParams.get('accountId')
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)
    const flaggedParam = searchParams.get('flagged')
    // txnType: "credit" | "debit" | "transfer"
    const txnType = searchParams.get('txnType')

    let query = supabase
      .from('transactions')
      .select('*, account:accounts(*), category:categories(*)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    let countQuery = supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (accountId) {
      query = query.eq('account_id', accountId)
      countQuery = countQuery.eq('account_id', accountId)
    }
    if (categoryId === '__uncategorized__') {
      query = query.is('category_id', null)
      countQuery = countQuery.is('category_id', null)
    } else if (categoryId) {
      query = query.eq('category_id', categoryId)
      countQuery = countQuery.eq('category_id', categoryId)
    }
    if (startDate) {
      query = query.gte('date', startDate)
      countQuery = countQuery.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
      countQuery = countQuery.lte('date', endDate)
    }
    if (search) {
      query = query.ilike('description', `%${search}%`)
      countQuery = countQuery.ilike('description', `%${search}%`)
    }
    if (flaggedParam !== null) {
      const flaggedBool = flaggedParam === 'true'
      query = query.eq('flagged', flaggedBool)
      countQuery = countQuery.eq('flagged', flaggedBool)
    }
    if (txnType === 'transfer') {
      query = query.eq('is_internal_transfer', true)
      countQuery = countQuery.eq('is_internal_transfer', true)
    } else if (txnType === 'credit') {
      query = query.eq('cr_dr', 'credit').eq('is_internal_transfer', false)
      countQuery = countQuery.eq('cr_dr', 'credit').eq('is_internal_transfer', false)
    } else if (txnType === 'debit') {
      query = query.eq('cr_dr', 'debit').eq('is_internal_transfer', false)
      countQuery = countQuery.eq('cr_dr', 'debit').eq('is_internal_transfer', false)
    }

    query = query.range(offset, offset + limit - 1)

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query,
      countQuery,
    ])

    if (error || countError) {
      console.error('Transactions fetch error:', error ?? countError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (err) {
    console.error('Transactions GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [aiModel, body] = await Promise.all([
      getUserModel(supabase, user.id),
      request.json(),
    ])
    const {
      account_id,
      category_id,
      description,
      amount_usd,
      cr_dr,
      date,
      notes,
      original_currency,
      loan_id,
      // Inter-account transfer fields
      target_account_id,
    } = body

    const final_amount = cr_dr === 'credit' ? amount_usd : -amount_usd
    const amount_original = amount_usd

    // ── Inter-account transfer detection ─────────────────────────────────────
    // If target_account_id is provided, this is an internal transfer.
    // Create paired transactions atomically.
    if (target_account_id && target_account_id !== account_id) {
      const transferGroupId = randomUUID()

      // Find or create the "Transfer" category for this user
      let transferCategoryId: string | null = null
      const { data: transferCat } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Transfer')
        .single()
      transferCategoryId = transferCat?.id ?? null

      // Transaction A: debit from source account
      const { data: txnA, error: errA } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id,
          category_id: transferCategoryId,
          description: description || `Transfer to account`,
          amount_usd: -amount_usd,
          final_amount: -amount_usd,
          amount_original,
          original_currency: original_currency ?? 'USD',
          cr_dr: 'debit',
          date,
          notes: notes ?? null,
          source: 'manual',
          import_status: 'confirmed',
          flagged: false,
          is_recurring: false,
          ai_categorized: false,
          is_internal_transfer: true,
          transfer_group_id: transferGroupId,
        })
        .select()
        .single()

      if (errA || !txnA) {
        console.error('Transfer txnA insert error:', errA)
        return NextResponse.json({ error: 'Failed to create transfer (source)' }, { status: 500 })
      }

      // Transaction B: credit into target account
      const { data: txnB, error: errB } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: target_account_id,
          category_id: transferCategoryId,
          description: description || `Transfer from account`,
          amount_usd,
          final_amount: amount_usd,
          amount_original,
          original_currency: original_currency ?? 'USD',
          cr_dr: 'credit',
          date,
          notes: notes ?? null,
          source: 'manual',
          import_status: 'confirmed',
          flagged: false,
          is_recurring: false,
          ai_categorized: false,
          is_internal_transfer: true,
          transfer_group_id: transferGroupId,
          linked_transaction_id: txnA.id,
        })
        .select()
        .single()

      if (errB || !txnB) {
        // Rollback txnA — account balances haven't been touched yet, so just delete the record
        const { error: rollbackErr } = await supabase.from('transactions').delete().eq('id', txnA.id)
        if (rollbackErr) console.error('Transfer rollback failed for txnA:', rollbackErr)
        console.error('Transfer txnB insert error:', errB)
        return NextResponse.json({ error: 'Failed to create transfer (target)' }, { status: 500 })
      }

      // Cross-link txnA → txnB (txnB already has linked_transaction_id = txnA.id)
      const { error: linkErr } = await supabase
        .from('transactions')
        .update({ linked_transaction_id: txnB.id })
        .eq('id', txnA.id)
      if (linkErr) {
        console.error('Failed to set reverse link on txnA:', linkErr)
        // Non-fatal: both transactions exist, just the reverse link is missing
      }

      // Sync both account balances (read-modify-write; best-effort, non-atomic)
      await Promise.all([
        (async () => {
          const { data: acct } = await supabase
            .from('accounts').select('current_balance').eq('id', account_id).eq('user_id', user.id).single()
          if (acct) {
            await supabase.from('accounts')
              .update({ current_balance: (acct.current_balance ?? 0) - amount_usd })
              .eq('id', account_id).eq('user_id', user.id)
          }
        })(),
        (async () => {
          const { data: acct } = await supabase
            .from('accounts').select('current_balance').eq('id', target_account_id).eq('user_id', user.id).single()
          if (acct) {
            await supabase.from('accounts')
              .update({ current_balance: (acct.current_balance ?? 0) + amount_usd })
              .eq('id', target_account_id).eq('user_id', user.id)
          }
        })(),
      ])

      return NextResponse.json({ ...txnA, linked_transaction: txnB }, { status: 201 })
    }

    // ── Standard transaction flow ─────────────────────────────────────────────

    // ── Smart auto-categorization (if no category provided) ──────────────────
    let resolvedCategoryId = category_id ?? null
    let aiCategorized = false
    let aiConfidence: number | null = null

    if (!category_id && description && process.env.ANTHROPIC_API_KEY) {
      try {
        const { data: cats } = await supabase
          .from('categories')
          .select('id, name, type')
          .eq('user_id', user.id)
          .order('name')

        if (cats && cats.length > 0) {
          const catList = cats.map(c => `${c.id} | ${c.name} (${c.type})`).join('\n')
          const msg = await anthropic.messages.create({
            model: aiModel,
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `Categorize this transaction. Merchant: "${description}", Amount: $${amount_usd}, Type: ${cr_dr}.\n\nCategories:\n${catList}\n\nReply with ONLY the category ID (UUID) that best fits, then a pipe, then a confidence 0-100. Example: "abc123-... | 85". If none fit, reply "none".`,
            }],
          })
          const reply = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
          const [suggestedId, confStr] = reply.split('|').map(s => s.trim())
          if (suggestedId !== 'none' && cats.some(c => c.id === suggestedId)) {
            resolvedCategoryId = suggestedId
            aiCategorized = true
            aiConfidence = confStr ? parseInt(confStr, 10) : null
          }
        }
      } catch {
        // Non-fatal: proceed without AI categorization
      }
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        account_id,
        category_id: resolvedCategoryId,
        description,
        amount_usd: final_amount,
        final_amount,
        amount_original,
        original_currency: original_currency ?? 'USD',
        cr_dr,
        date,
        notes: notes ?? null,
        loan_id: loan_id ?? null,
        source: 'manual',
        import_status: 'confirmed',
        flagged: false,
        is_recurring: false,
        ai_categorized: aiCategorized,
        ai_confidence: aiConfidence,
        is_internal_transfer: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Transaction insert error:', error)
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
    }

    // ── Anomaly detection ────────────────────────────────────────────────────
    const flagReasons: string[] = []

    // Rule 1: Duplicate within 24h — same description + amount
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: dupes } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('description', description)
      .eq('amount_usd', final_amount)
      .gte('date', oneDayAgo)
      .neq('id', data.id)
      .limit(1)
    if (dupes && dupes.length > 0) {
      flagReasons.push('Possible duplicate within 24h')
    }

    // Rule 2: Very large round number (≥$5000, divisible by $500) — avoids flagging normal bills/rent
    if (cr_dr === 'debit' && amount_usd >= 5000 && amount_usd % 500 === 0) {
      flagReasons.push(`Large round-number transaction ($${amount_usd})`)
    }

    // Rule 3: Amount > 2× category average (last 3 months, min 3 prior transactions)
    if (category_id && cr_dr === 'debit') {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const { data: catTxns } = await supabase
        .from('transactions')
        .select('amount_usd')
        .eq('user_id', user.id)
        .eq('category_id', category_id)
        .eq('cr_dr', 'debit')
        .gte('date', threeMonthsAgo.toISOString().split('T')[0])
        .neq('id', data.id)
      if (catTxns && catTxns.length >= 3) {
        const avg = catTxns.reduce((s, t) => s + Math.abs(t.amount_usd), 0) / catTxns.length
        if (amount_usd > avg * 2) {
          flagReasons.push(`Amount ($${amount_usd.toFixed(2)}) is 2× the category average ($${avg.toFixed(2)})`)
        }
      }
    }

    if (flagReasons.length > 0) {
      const flaggedReason = flagReasons.join('; ')
      await supabase
        .from('transactions')
        .update({ flagged: true, flagged_reason: flaggedReason })
        .eq('id', data.id)
      data.flagged = true
      data.flagged_reason = flaggedReason
    }

    // Sync account balance — amount_usd is signed (+credit / −debit)
    if (account_id) {
      try {
        const { data: acct } = await supabase
          .from('accounts')
          .select('current_balance')
          .eq('id', account_id)
          .eq('user_id', user.id)
          .single()
        if (acct) {
          await supabase
            .from('accounts')
            .update({ current_balance: (acct.current_balance ?? 0) + (data.amount_usd ?? 0) })
            .eq('id', account_id)
            .eq('user_id', user.id)
        }
      } catch { /* non-fatal */ }
    }

    // Sync loan balance when loan_id is set (debit transaction reduces loan balance)
    if (loan_id) {
      try {
        const { data: loan } = await supabase
          .from('loans')
          .select('current_balance')
          .eq('id', loan_id)
          .eq('user_id', user.id)
          .single()
        if (loan) {
          // Debits (negative amount_usd) reduce the loan balance
          const delta = -(data.amount_usd ?? 0) // flip sign: debit payment reduces loan
          await supabase
            .from('loans')
            .update({ current_balance: Math.max(0, (loan.current_balance ?? 0) + delta) })
            .eq('id', loan_id)
        }
      } catch { /* non-fatal */ }
    }

    // Update subscription due date if a transaction matches a subscription name/date
    // This prevents "overdue" status when the user has already paid for the month
    if (cr_dr === 'debit' && account_id) {
      try {
        const txnDate = new Date(date)
        const txnMonth = txnDate.getMonth()
        const txnYear = txnDate.getFullYear()

        // Find active subscriptions that should have been billed this month
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('id, name, next_billing_date, billing_cost, billing_cycle_months')
          .eq('user_id', user.id)
          .eq('status', 'active')

        if (subs) {
          for (const sub of subs) {
            if (!sub.next_billing_date) continue

            const subDate = new Date(sub.next_billing_date)
            const subMonth = subDate.getMonth()
            const subYear = subDate.getFullYear()

            // Check if subscription is for the same month as transaction
            // and the transaction amount is close to the subscription cost (within 10%)
            const amountMatch = Math.abs(Math.abs(data.amount_usd) - sub.billing_cost) <= (sub.billing_cost * 0.1)
            const nameMatch = sub.name.toLowerCase().includes(description.toLowerCase()) ||
                             description.toLowerCase().includes(sub.name.toLowerCase())

            if (txnMonth === subMonth && txnYear === subYear && amountMatch && nameMatch) {
              // Move subscription to next billing cycle
              const nextMonth = new Date(subDate)
              nextMonth.setMonth(nextMonth.getMonth() + sub.billing_cycle_months)
              await supabase
                .from('subscriptions')
                .update({ next_billing_date: nextMonth.toISOString().split('T')[0] })
                .eq('id', sub.id)
            }
          }
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Transactions POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
