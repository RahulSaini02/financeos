import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'
import { getUserPrompt } from '@/lib/get-user-prompt'
import { formatCurrency } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const fmt = (n: number) => formatCurrency(n)

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Force param ───────────────────────────────────────────────
    const url = new URL(request.url)
    const force = url.searchParams.get('force') === 'true'

    // ── Date ranges (15-day periods) ─────────────────────────────
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dayOfMonth = now.getDate()
    const isFirstHalf = dayOfMonth <= 15

    // Current period bounds
    const periodStart = isFirstHalf
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), 16)
    const periodEnd = isFirstHalf
      ? new Date(now.getFullYear(), now.getMonth(), 15)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0) // last day of month

    // Cache key
    const periodKey = isFirstHalf
      ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-16`

    // Label for display
    const endDay = periodEnd.getDate()
    const label = isFirstHalf
      ? `${periodStart.toLocaleDateString('en-US', { month: 'long' })} 1–15, ${now.getFullYear()}`
      : `${periodStart.toLocaleDateString('en-US', { month: 'long' })} 16–${endDay}, ${now.getFullYear()}`

    // Prior period bounds (the 15-day window before this one)
    const priorPeriodEnd = new Date(periodStart.getTime() - 86400000)
    const priorPeriodStart = isFirstHalf
      ? new Date(now.getFullYear(), now.getMonth() - 1, 16) // second half of previous month
      : new Date(now.getFullYear(), now.getMonth(), 1) // first half of this month

    // ── Cache check ───────────────────────────────────────────────
    const { data: cachedInsight } = await supabase
      .from('ai_insights')
      .select('content')
      .eq('user_id', user.id)
      .eq('type', 'monthly_review')
      .eq('month', periodKey)
      .maybeSingle()

    let analysis = ''
    let isCached = false

    // Skip cache if it contains the fallback "no API key" message — key may have been added since
    const isStubContent = cachedInsight?.content?.includes('Configure `ANTHROPIC_API_KEY`')
    if (cachedInsight && !force && !isStubContent) {
      analysis = cachedInsight.content
      isCached = true
    }

    // ── Fetch transactions ────────────────────────────────────────
    const [lastMonthRes, priorMonthRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('description, amount_usd, cr_dr, date, category:categories(id, name)')
        .eq('user_id', user.id)
        .eq('import_status', 'confirmed')
        .eq('is_internal_transfer', false)
        .gte('date', periodStart.toISOString().split('T')[0])
        .lte('date', periodEnd.toISOString().split('T')[0]),
      supabase
        .from('transactions')
        .select('amount_usd, cr_dr, category:categories(name)')
        .eq('user_id', user.id)
        .eq('import_status', 'confirmed')
        .eq('is_internal_transfer', false)
        .gte('date', priorPeriodStart.toISOString().split('T')[0])
        .lte('date', priorPeriodEnd.toISOString().split('T')[0]),
    ])

    const transactions = lastMonthRes.data ?? []
    const priorTransactions = priorMonthRes.data ?? []

    // ── Aggregate last month ──────────────────────────────────────
    const income = transactions
      .filter(t => t.cr_dr === 'credit')
      .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)

    const expenses = transactions
      .filter(t => t.cr_dr === 'debit')
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

    // ── Prior month category map ──────────────────────────────────
    const priorByCategory: Record<string, number> = {}
    for (const t of priorTransactions) {
      if (t.cr_dr === 'debit') {
        const cat = (t.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
        priorByCategory[cat] = (priorByCategory[cat] ?? 0) + Math.abs(t.amount_usd ?? 0)
      }
    }

    const hasPriorMonth = Object.keys(priorByCategory).length > 0

    // ── Top categories with MoM ───────────────────────────────────
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 8)
      .map(([name, { amount, count }]) => {
        const prevAmount = priorByCategory[name] ?? null
        const changePct = prevAmount != null ? ((amount - prevAmount) / prevAmount) * 100 : null
        const pctOfTotal = expenses > 0 ? (amount / expenses) * 100 : 0
        return { name, amount, count, pctOfTotal, prevAmount, changePct }
      })

    // ── LLM analysis (skip if cached) ────────────────────────────
    if (!isCached && process.env.ANTHROPIC_API_KEY) {
      const top3 = topCategories
        .slice(0, 3)
        .map(c => `${c.name} ${fmt(c.amount)}`)
        .join(', ')

      const priorIncome = priorTransactions
        .filter(t => t.cr_dr === 'credit')
        .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)
      const priorExpenses = priorTransactions
        .filter(t => t.cr_dr === 'debit')
        .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0)

      const userMessage = `Review my last 15 days (${label}):
- Income: ${fmt(income)}, Expenses: ${fmt(expenses)}, Net: ${fmt(income - expenses)}
- Top categories: ${top3 || 'None'}
- Transactions: ${transactions.length}
${hasPriorMonth ? `Prior 15 days: Income ${fmt(priorIncome)}, Expenses ${fmt(priorExpenses)}` : '(No prior period data)'}`

      const reviewSystemPrompt = await getUserPrompt(
        supabase,
        user.id,
        'ai_review',
        DEFAULT_PROMPTS.ai_review.content,
      )

      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        system: reviewSystemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      analysis = msg.content[0].type === 'text' ? msg.content[0].text : ''

      // Save to cache
      await supabase.from('ai_insights').upsert({
        user_id: user.id,
        type: 'monthly_review',
        content: analysis,
        month: periodKey,
        is_read: false,
      }, { onConflict: 'user_id,type,month' })
    } else if (!isCached) {
      // No API key — return a simple fallback
      analysis = `${income >= expenses ? 'Positive' : 'Negative'} cash flow of **${fmt(Math.abs(income - expenses))}** for ${label} — ${fmt(income)} income vs ${fmt(expenses)} expenses. Configure \`ANTHROPIC_API_KEY\` to enable full AI analysis.`
    }

    return NextResponse.json({
      label,
      month: periodKey,
      cached: isCached,
      summary: {
        income,
        expenses,
        netCashFlow: income - expenses,
        transactionCount: transactions.length,
      },
      topCategories,
      hasPriorMonth,
      analysis,
    })
  } catch (err) {
    console.error('AI Review error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
