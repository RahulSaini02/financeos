import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ── helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-01" ISO date string for the first of the month */
function monthStart(year: number, month: number): string {
  return `${year}-${pad(month)}-01`
}

/** Last day of the given month as "YYYY-MM-DD" */
function monthEnd(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().split('T')[0]
}

/** "Apr '26" style label */
function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
}

function clampSavingsRate(income: number, expenses: number): number {
  if (income === 0) return 0
  const rate = ((income - expenses) / income) * 100
  return Math.max(-100, Math.min(100, rate))
}

// ── types ─────────────────────────────────────────────────────────────────────

interface MonthlyPoint {
  month: string
  label: string
  income: number
  expenses: number
  savingsRate: number
  netCashFlow: number
}

interface CategoryTrendPoint {
  month: string
  label: string
  [categoryName: string]: number | string
}

interface AnalyticsResponse {
  monthlyData: MonthlyPoint[]
  categoryTrends: CategoryTrendPoint[]
  topCategories: string[]
  projection: MonthlyPoint[]
  networthPoints: Array<{ month: string; net_worth: number }>
  summary: {
    avgMonthlyIncome: number
    avgMonthlyExpenses: number
    avgSavingsRate: number
    projectedNetCashFlow3Mo: number
    currentNetWorth: number
  }
}

// ── route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Build 12 completed months (skip current partial month) ───────────────
    const now = new Date()
    // "last month" = most recent completed month
    const lastCompleted = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // months[0] = oldest (11 months before lastCompleted), months[11] = lastCompleted
    const months: Array<{ year: number; month: number }> = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth() - i, 1)
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }

    const firstMonthStart = monthStart(months[0].year, months[0].month)
    const lastMonthEnd = monthEnd(months[11].year, months[11].month)

    // ── Fetch transactions + net worth snapshots in parallel ─────────────────
    const [txnRes, networthRes] = await Promise.all([
      supabase
        .from('transactions')
        .select(
          'amount_usd, cr_dr, date, category:categories(name), is_internal_transfer, import_status',
        )
        .eq('user_id', user.id)
        .eq('is_internal_transfer', false)
        .eq('import_status', 'confirmed')
        .gte('date', firstMonthStart)
        .lte('date', lastMonthEnd),

      supabase
        .from('networth_snapshots')
        .select('month, net_worth')
        .eq('user_id', user.id)
        .order('month', { ascending: true })
        .limit(12),
    ])

    const transactions = txnRes.data ?? []

    // ── Aggregate income / expenses by "YYYY-MM" key ─────────────────────────
    const monthMap: Record<string, { income: number; expenses: number }> = {}

    for (const txn of transactions) {
      const key = (txn.date as string).substring(0, 7) // "YYYY-MM"
      if (!monthMap[key]) monthMap[key] = { income: 0, expenses: 0 }
      const amt = txn.amount_usd as number
      if (amt > 0) {
        monthMap[key].income += amt
      } else if (amt < 0) {
        monthMap[key].expenses += Math.abs(amt)
      }
    }

    // ── Build monthlyData (ascending, oldest first) ───────────────────────────
    const monthlyData: MonthlyPoint[] = months.map(({ year, month }) => {
      const key = `${year}-${pad(month)}`
      const income = Math.round((monthMap[key]?.income ?? 0) * 100) / 100
      const expenses = Math.round((monthMap[key]?.expenses ?? 0) * 100) / 100
      return {
        month: monthStart(year, month),
        label: monthLabel(year, month),
        income,
        expenses,
        savingsRate: Math.round(clampSavingsRate(income, expenses) * 100) / 100,
        netCashFlow: Math.round((income - expenses) * 100) / 100,
      }
    })

    // ── Category trends — last 6 months ──────────────────────────────────────
    const last6Months = months.slice(6) // indices 6..11 → last 6 months

    const last6Keys = new Set(last6Months.map(({ year, month }) => `${year}-${pad(month)}`))

    // Accumulate total expense per category over the 6-month window
    const catTotals: Record<string, number> = {}
    // Per-month per-category expense
    const catByMonth: Record<string, Record<string, number>> = {}

    for (const txn of transactions) {
      const key = (txn.date as string).substring(0, 7)
      if (!last6Keys.has(key)) continue
      const amt = txn.amount_usd as number
      if (amt >= 0) continue // skip income

      const catName =
        (txn.category as unknown as { name: string } | null)?.name ?? 'Uncategorized'
      const absAmt = Math.abs(amt)

      catTotals[catName] = (catTotals[catName] ?? 0) + absAmt

      if (!catByMonth[key]) catByMonth[key] = {}
      catByMonth[key][catName] = (catByMonth[key][catName] ?? 0) + absAmt
    }

    // Top 5 expense categories by total
    const topCategories = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    // Build categoryTrends for last 6 months
    const categoryTrends: CategoryTrendPoint[] = last6Months.map(({ year, month }) => {
      const key = `${year}-${pad(month)}`
      const point: CategoryTrendPoint = {
        month: monthStart(year, month),
        label: monthLabel(year, month),
      }
      for (const cat of topCategories) {
        point[cat] = Math.round((catByMonth[key]?.[cat] ?? 0) * 100) / 100
      }
      return point
    })

    // ── Projection — rolling avg of last 3 months ─────────────────────────────
    const last3 = monthlyData.slice(-3)
    const avgIncome3Mo =
      last3.reduce((s, m) => s + m.income, 0) / Math.max(last3.length, 1)
    const avgExpenses3Mo =
      last3.reduce((s, m) => s + m.expenses, 0) / Math.max(last3.length, 1)

    // Next 3 calendar months after today's current month
    const projection: MonthlyPoint[] = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1)
      const y = d.getFullYear()
      const mo = d.getMonth() + 1
      const income = Math.round(avgIncome3Mo * 100) / 100
      const expenses = Math.round(avgExpenses3Mo * 100) / 100
      return {
        month: monthStart(y, mo),
        label: monthLabel(y, mo),
        income,
        expenses,
        savingsRate: Math.round(clampSavingsRate(income, expenses) * 100) / 100,
        netCashFlow: Math.round((income - expenses) * 100) / 100,
      }
    })

    // ── Net worth ─────────────────────────────────────────────────────────────
    const networthPoints = (networthRes.data ?? []).map((s) => ({
      month: s.month as string,
      net_worth: s.net_worth as number,
    }))

    const currentNetWorth =
      networthPoints.length > 0
        ? networthPoints[networthPoints.length - 1].net_worth
        : 0

    // ── Summary — skip months with 0 income to avoid skewing avg ─────────────
    const activeMonths = monthlyData.filter((m) => m.income > 0)
    const avgMonthlyIncome =
      activeMonths.length > 0
        ? Math.round(
            (activeMonths.reduce((s, m) => s + m.income, 0) / activeMonths.length) * 100,
          ) / 100
        : 0
    const avgMonthlyExpenses =
      activeMonths.length > 0
        ? Math.round(
            (activeMonths.reduce((s, m) => s + m.expenses, 0) / activeMonths.length) *
              100,
          ) / 100
        : 0
    const avgSavingsRate =
      activeMonths.length > 0
        ? Math.round(
            (activeMonths.reduce((s, m) => s + m.savingsRate, 0) / activeMonths.length) *
              100,
          ) / 100
        : 0
    const projectedNetCashFlow3Mo = Math.round(
      projection.reduce((s, m) => s + m.netCashFlow, 0) * 100,
    ) / 100

    const response: AnalyticsResponse = {
      monthlyData,
      categoryTrends,
      topCategories,
      projection,
      networthPoints,
      summary: {
        avgMonthlyIncome,
        avgMonthlyExpenses,
        avgSavingsRate,
        projectedNetCashFlow3Mo,
        currentNetWorth,
      },
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err) {
    console.error('Analytics error:', err)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
