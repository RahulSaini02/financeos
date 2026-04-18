import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/cron/monthly-review
 * Runs on the 1st of each month at 6 AM UTC.
 * Pre-generates and caches the AI monthly review for all users
 * who had transactions last month and don't yet have a cached review.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'No ANTHROPIC_API_KEY' })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const now = new Date()

    // Last month date range
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const lastMonthKey = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`
    const label = lastMonthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Month before last (for MoM comparison)
    const priorStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const priorEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0)

    // Find distinct users who had transactions last month
    const { data: activeRows } = await supabase
      .from('transactions')
      .select('user_id')
      .gte('date', lastMonthStart.toISOString().split('T')[0])
      .lte('date', lastMonthEnd.toISOString().split('T')[0])
      .eq('import_status', 'confirmed')

    const uniqueUserIds = [...new Set((activeRows ?? []).map((r) => r.user_id))]

    if (uniqueUserIds.length === 0) {
      return NextResponse.json({ month: lastMonthKey, usersProcessed: 0, skippedCached: 0 })
    }

    // Check which users already have a cached review for last month
    const { data: cachedRows } = await supabase
      .from('ai_insights')
      .select('user_id')
      .eq('type', 'monthly_review')
      .eq('month', lastMonthKey)
      .in('user_id', uniqueUserIds)

    const cachedUserIds = new Set((cachedRows ?? []).map((r) => r.user_id))
    const usersToProcess = uniqueUserIds.filter((id) => !cachedUserIds.has(id))

    const results: { userId: string; status: 'generated' | 'error' }[] = []

    for (const userId of usersToProcess) {
      try {
        const [lastMonthRes, priorMonthRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('description, amount_usd, cr_dr, date, category:categories(id, name)')
            .eq('user_id', userId)
            .eq('import_status', 'confirmed')
            .eq('is_internal_transfer', false)
            .gte('date', lastMonthStart.toISOString().split('T')[0])
            .lte('date', lastMonthEnd.toISOString().split('T')[0]),
          supabase
            .from('transactions')
            .select('amount_usd, cr_dr, category:categories(name)')
            .eq('user_id', userId)
            .eq('import_status', 'confirmed')
            .eq('is_internal_transfer', false)
            .gte('date', priorStart.toISOString().split('T')[0])
            .lte('date', priorEnd.toISOString().split('T')[0]),
        ])

        const transactions = lastMonthRes.data ?? []
        const priorTransactions = priorMonthRes.data ?? []

        const income = transactions
          .filter((t) => t.cr_dr === 'credit')
          .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)

        const expenses = transactions
          .filter((t) => t.cr_dr === 'debit')
          .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)

        const byCategory: Record<string, { amount: number; count: number }> = {}
        for (const t of transactions) {
          if (t.cr_dr === 'debit') {
            const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
            if (!byCategory[cat]) byCategory[cat] = { amount: 0, count: 0 }
            byCategory[cat].amount += Math.abs(t.amount_usd ?? 0)
            byCategory[cat].count++
          }
        }

        const priorByCategory: Record<string, number> = {}
        for (const t of priorTransactions) {
          if (t.cr_dr === 'debit') {
            const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
            priorByCategory[cat] = (priorByCategory[cat] ?? 0) + Math.abs(t.amount_usd ?? 0)
          }
        }

        const hasPriorMonth = Object.keys(priorByCategory).length > 0

        const topCategories = Object.entries(byCategory)
          .sort((a, b) => b[1].amount - a[1].amount)
          .slice(0, 8)
          .map(([name, { amount, count }]) => {
            const prevAmount = priorByCategory[name] ?? null
            const changePct = prevAmount != null ? ((amount - prevAmount) / prevAmount) * 100 : null
            const pctOfTotal = expenses > 0 ? (amount / expenses) * 100 : 0
            return { name, amount, count, pctOfTotal, prevAmount, changePct }
          })

        const topTxns = transactions
          .filter((t) => t.cr_dr === 'debit')
          .sort((a, b) => Math.abs(b.amount_usd ?? 0) - Math.abs(a.amount_usd ?? 0))
          .slice(0, 5)

        const categorySummaryLines = topCategories
          .map((c) => {
            let line = `- ${c.name}: ${fmt(c.amount)} (${c.count} txns, ${c.pctOfTotal.toFixed(1)}% of expenses)`
            if (hasPriorMonth && c.prevAmount != null && c.changePct != null) {
              const direction = c.changePct >= 0 ? 'up' : 'down'
              line += ` — ${direction} ${Math.abs(c.changePct).toFixed(1)}% vs prior month (${fmt(c.prevAmount)})`
            }
            return line
          })
          .join('\n')

        const userMessage = `
Analyze my spending for ${label}:

## Summary
- Income: ${fmt(income)}
- Expenses: ${fmt(expenses)}
- Net Cash Flow: ${fmt(income - expenses)}
- Transactions: ${transactions.length}

## Top Spending Categories
${categorySummaryLines || '- No spending data'}

## Top Individual Transactions
${topTxns.map((t) => `- ${t.description}: ${fmt(Math.abs(t.amount_usd ?? 0))} on ${t.date}`).join('\n') || '- None'}
${hasPriorMonth ? '' : '\n(No prior month data available — skip the Month-over-Month section.)'}
`.trim()

        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 900,
          system: `You are FinanceOS, a personal finance analyst reviewing last month's spending.

Structure your response with exactly these four sections using ## headers:

## TLDR
(2–3 sentences: biggest takeaway, key number, one immediate action)

## Key Highlights
(3–5 bullet points: notable patterns, anything unusual, positive trends)

## Category Breakdown
(brief narrative on top 2–3 spending categories — context on why they matter)

## Month-over-Month Changes
(bullet points comparing to the prior month — highlight significant increases/decreases by %. Skip this section entirely if no prior month data is provided.)

Be specific with dollar amounts. Keep total response under 400 words. No long paragraphs.`,
          messages: [{ role: 'user', content: userMessage }],
        })

        const analysis = msg.content[0].type === 'text' ? msg.content[0].text : ''

        await supabase.from('ai_insights').upsert(
          {
            user_id: userId,
            type: 'monthly_review',
            content: analysis,
            month: lastMonthKey,
            is_read: false,
          },
          { onConflict: 'user_id,type,month' }
        )

        results.push({ userId, status: 'generated' })
      } catch (err) {
        console.error(`Monthly review cron failed for user ${userId}:`, err)
        results.push({ userId, status: 'error' })
      }
    }

    return NextResponse.json({
      month: lastMonthKey,
      usersProcessed: results.length,
      skippedCached: cachedUserIds.size,
      results: results.map((r) => ({ ...r, userId: r.userId.slice(0, 8) + '…' })),
    })
  } catch (err) {
    console.error('Monthly review cron error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
