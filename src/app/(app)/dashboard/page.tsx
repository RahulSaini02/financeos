import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardHeader, CardTitle, CardValue, CardChange } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Bell,
  Plus,
  ChevronRight,
  Receipt,
  CalendarClock,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DashboardCharts } from "./DashboardCharts";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { DashboardInsightLoader } from "./DashboardInsightLoader";
import { DashboardWelcomeBanner } from "@/components/dashboard/DashboardWelcomeBanner";
import { EmptySection } from "@/components/dashboard/EmptySection";
import { MonthSelector } from "./MonthSelector";
import { BudgetProgressBars } from "@/components/dashboard/BudgetProgressBars";
import { Sparkline } from "@/components/ui/sparkline";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpcomingBill {
  name: string;
  due_date: string;
  amount: number;
  paid: boolean;
  overdue: boolean;
}

interface Transaction {
  id: string;
  description: string;
  final_amount: number;
  date: string;
  flagged: boolean;
  categories?: { name: string; id: string } | null;
  accounts?: { name: string } | null;
}

type AlertType = 'budget_80' | 'budget_100' | 'anomaly' | 'upcoming_bill';

interface DashboardAlert {
  id: string;
  type: AlertType;
  title: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
}

interface BudgetSummaryItem {
  id: string;
  categoryName: string;
  limit: number;
  spent: number;
  pct: number;
}

function getDaysUntilDue( dateStr: string ): number {
  const today = new Date();
  today.setHours( 0, 0, 0, 0 );
  const due = new Date( dateStr );
  due.setHours( 0, 0, 0, 0 );
  return Math.round( ( due.getTime() - today.getTime() ) / ( 1000 * 60 * 60 * 24 ) );
}

// ── MetricCard sub-component ───────────────────────────────────────────────────

function MetricCard ( {
  label,
  value,
  change,
  changeLabel,
  positive,
  href,
  sparklineData,
  projectedValue,
}: {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  positive?: boolean;
  href?: string;
  sparklineData?: number[];
  projectedValue?: string;
} ) {
  const trendColor = sparklineData && sparklineData.length >= 2
    ? sparklineData[sparklineData.length - 1] >= sparklineData[sparklineData.length - 2]
      ? '#22c55e'
      : '#ef4444'
    : '#6366f1';

  const content = (
    <Card className={`hover:border-[var(--color-accent)] transition-colors cursor-pointer`}>
      <CardTitle>{label}</CardTitle>
      <div className="flex items-end justify-between mt-2">
        <CardValue>{value}</CardValue>
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline data={sparklineData} color={trendColor} width={72} height={28} />
        )}
      </div>
      {/* Always reserve this line's height so all cards stay equal */}
      <p className={`text-[10px] mt-0.5 h-[14px] leading-[14px] ${
        projectedValue
          ? "text-[var(--color-text-secondary)] opacity-80"
          : "opacity-0 pointer-events-none select-none"
      }`}>
        {projectedValue ?? " "}
      </p>
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {positive ? (
            <ArrowUpRight className="h-3 w-3 text-[var(--color-success)]" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-[var(--color-danger)]" />
          )}
          <CardChange positive={positive}>
            {change > 0 ? "+" : ""}
            {change.toFixed( 1 )}% {changeLabel}
          </CardChange>
        </div>
      )}
    </Card>
  );

  if ( href ) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ── Data fetching ──────────────────────────────────────────────────────────────

const CATEGORY_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#64748b'];

async function getDashboardData ( userId: string, monthParam?: string ) {
  const supabase = await createServerSupabaseClient();

  const today = new Date();
  const pad = ( n: number ) => String( n ).padStart( 2, '0' );

  // Parse the requested month or fall back to current
  const viewDate = monthParam
    ? new Date( parseInt( monthParam.split( '-' )[0] ), parseInt( monthParam.split( '-' )[1] ) - 1, 1 )
    : new Date( today.getFullYear(), today.getMonth(), 1 );
  const isCurrentMonth =
    viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();

  const firstDay = `${ viewDate.getFullYear() }-${ pad( viewDate.getMonth() + 1 ) }-01`;
  const lastDay = new Date( viewDate.getFullYear(), viewDate.getMonth() + 1, 0 ).toISOString().split( 'T' )[0];

  // Bills always use today (not the selected view month)
  const todayStr = today.toISOString().split( 'T' )[0];
  const sevenDaysFromNow = new Date( today );
  sevenDaysFromNow.setDate( sevenDaysFromNow.getDate() + 7 );
  const sevenDaysStr = sevenDaysFromNow.toISOString().split( 'T' )[0];
  const thirtyDaysFromNow = new Date( today );
  thirtyDaysFromNow.setDate( thirtyDaysFromNow.getDate() + 30 );
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split( 'T' )[0];
  const thirtyDaysAgo = new Date( today );
  thirtyDaysAgo.setDate( thirtyDaysAgo.getDate() - 30 );
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split( 'T' )[0];

  // 12-month window ends at the last day of the selected view month
  const twelveMonthsAgoDate = new Date( viewDate.getFullYear(), viewDate.getMonth() - 11, 1 );
  const twelveMonthsAgoStr = `${ twelveMonthsAgoDate.getFullYear() }-${ pad( twelveMonthsAgoDate.getMonth() + 1 ) }-01`;

  // Suppress unused variable warning — sevenDaysStr is kept for future use
  void sevenDaysStr;

  const [
    accountsRes, transactionsRes, flaggedRes, networthRes,
    billsRes, overdueBillsRes, twelveMonthTxnsRes, recentTxnsRes,
    budgetsRes, flaggedTxnsRes,
  ] = await Promise.all( [
    supabase.from( 'accounts' ).select( '*' ).eq( 'user_id', userId ).eq( 'is_active', true ),
    supabase.from( 'transactions' ).select( '*, category:categories(name, id)' ).eq( 'user_id', userId ).gte( 'date', firstDay ).lte( 'date', lastDay ),
    supabase.from( 'transactions' ).select( '*', { count: 'exact', head: true } ).eq( 'user_id', userId ).eq( 'flagged', true ),
    supabase.from( 'networth_snapshots' ).select( '*' ).eq( 'user_id', userId ).order( 'month', { ascending: false } ).limit( 12 ),
    // upcoming: today → today+30
    supabase.from( 'subscriptions' ).select( 'name, next_billing_date, billing_cost' ).eq( 'user_id', userId ).eq( 'status', 'active' ).not( 'next_billing_date', 'is', null ).gte( 'next_billing_date', todayStr ).lte( 'next_billing_date', thirtyDaysStr ).order( 'next_billing_date', { ascending: true } ),
    // overdue: today-30 → yesterday
    supabase.from( 'subscriptions' ).select( 'name, next_billing_date, billing_cost' ).eq( 'user_id', userId ).eq( 'status', 'active' ).not( 'next_billing_date', 'is', null ).gte( 'next_billing_date', thirtyDaysAgoStr ).lt( 'next_billing_date', todayStr ).order( 'next_billing_date', { ascending: false } ),
    supabase.from( 'transactions' ).select( 'amount_usd, cr_dr, date, category:categories(name)' ).eq( 'user_id', userId ).eq( 'is_internal_transfer', false ).gte( 'date', twelveMonthsAgoStr ).lte( 'date', lastDay ),
    supabase.from( 'transactions' ).select( 'id, description, final_amount, date, flagged, categories(name, id), accounts(name)' ).eq( 'user_id', userId ).order( 'date', { ascending: false } ).limit( 5 ),
    supabase.from( 'budgets' ).select( '*, category:categories(id, name)' ).eq( 'user_id', userId ).eq( 'month', firstDay ),
    supabase.from( 'transactions' ).select( 'id, description, amount_usd, date' ).eq( 'user_id', userId ).eq( 'flagged', true ).order( 'date', { ascending: false } ).limit( 5 ),
  ] );

  const accounts = accountsRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const flagged_count = flaggedRes.count ?? 0;
  const snapshots = networthRes.data ?? [];
  const bills = billsRes.data ?? [];
  const overdueBills = overdueBillsRes.data ?? [];

  const total_assets = accounts.filter( ( a ) => a.kind === 'asset' || a.kind === 'investment' ).reduce( ( s, a ) => s + ( a.current_balance ?? 0 ), 0 );
  const total_liabilities = accounts.filter( ( a ) => a.kind === 'liability' ).reduce( ( s, a ) => s + Math.abs( a.current_balance ?? 0 ), 0 );
  const net_worth = total_assets - total_liabilities;

  const monthly_income = transactions.filter( ( t ) => t.cr_dr === 'credit' && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
  const monthly_expenses = transactions.filter( ( t ) => t.cr_dr === 'debit' && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
  const savings_rate = monthly_income > 0 ? ( ( monthly_income - monthly_expenses ) / monthly_income ) * 100 : 0;

  const upcoming_bills: UpcomingBill[] = [
    ...overdueBills.map( ( b ) => ( { name: b.name, due_date: b.next_billing_date!, amount: b.billing_cost, paid: false, overdue: true } ) ),
    ...bills.map( ( b ) => ( { name: b.name, due_date: b.next_billing_date!, amount: b.billing_cost, paid: false, overdue: false } ) ),
  ];

  // Category breakdown (keyed by category_id to preserve IDs for drill-down)
  const catIdAndNameSpend: Record<string, { id: string; name: string; amount: number }> = {};
  for ( const t of transactions ) {
    if ( t.cr_dr === 'debit' && !t.is_internal_transfer ) {
      const cat = ( t.category as unknown as { name: string; id: string } | null );
      const catId = cat?.id ?? '__uncategorized__';
      const catName = cat?.name ?? 'Uncategorized';
      if ( !catIdAndNameSpend[catId] ) {
        catIdAndNameSpend[catId] = { id: catId, name: catName, amount: 0 };
      }
      catIdAndNameSpend[catId].amount += Math.abs( t.amount_usd ?? 0 );
    }
  }
  const sortedCats = Object.values( catIdAndNameSpend ).sort( ( a, b ) => b.amount - a.amount );
  const top6 = sortedCats.slice( 0, 6 );
  const otherTotal = sortedCats.slice( 6 ).reduce( ( s, item ) => s + item.amount, 0 );
  const categoryBreakdown = [
    ...top6.map( ( cat, i ) => ( { id: cat.id, name: cat.name, amount: cat.amount, color: CATEGORY_COLORS[i] } ) ),
    ...( otherTotal > 0 ? [{ id: '__other__', name: 'Other', amount: otherTotal, color: CATEGORY_COLORS[6] }] : [] ),
  ];

  // 12-month comparison
  const monthMap: Record<string, { income: number; expenses: number }> = {};
  const catMonthMap: Record<string, Record<string, number>> = {};
  for ( const t of twelveMonthTxnsRes.data ?? [] ) {
    const key = ( t.date as string ).substring( 0, 7 );
    if ( !monthMap[key] ) monthMap[key] = { income: 0, expenses: 0 };
    if ( t.cr_dr === 'credit' ) monthMap[key].income += Math.abs( t.amount_usd ?? 0 );
    else {
      monthMap[key].expenses += Math.abs( t.amount_usd ?? 0 );
      const catName = ( t.category as unknown as { name: string } | null )?.name ?? 'Uncategorized';
      if ( !catMonthMap[catName] ) catMonthMap[catName] = {};
      catMonthMap[catName][key] = ( catMonthMap[catName][key] ?? 0 ) + Math.abs( t.amount_usd ?? 0 );
    }
  }
  const monthlyData = Array.from( { length: 12 }, ( _, i ) => {
    const d = new Date( viewDate.getFullYear(), viewDate.getMonth() - ( 11 - i ), 1 );
    const key = `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }`;
    const label = d.toLocaleDateString( 'en-US', { month: 'short', year: '2-digit' } );
    return { month: key, label, income: Math.round( ( monthMap[key]?.income ?? 0 ) * 100 ) / 100, expenses: Math.round( ( monthMap[key]?.expenses ?? 0 ) * 100 ) / 100 };
  } );

  const categoryMonthlyData: Record<string, Array<{ month: string; label: string; expenses: number }>> = {};
  for ( const [catName, monthData] of Object.entries( catMonthMap ) ) {
    categoryMonthlyData[catName] = Array.from( { length: 12 }, ( _, i ) => {
      const d = new Date( viewDate.getFullYear(), viewDate.getMonth() - ( 11 - i ), 1 );
      const key = `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }`;
      const label = d.toLocaleDateString( 'en-US', { month: 'short', year: '2-digit' } );
      return { month: key, label, expenses: Math.round( ( monthData[key] ?? 0 ) * 100 ) / 100 };
    } );
  }

  // Upsert net worth snapshot and await so the chart reflects the current state
  await supabase.from( 'networth_snapshots' ).upsert( { user_id: userId, month: lastDay, assets_total: total_assets, liabilities_total: total_liabilities, net_worth }, { onConflict: 'user_id,month' } );

  // Build trend: existing snapshots (excluding current month) + current month injected fresh
  const historicalSnapshots = snapshots.filter( ( s ) => s.month !== lastDay );
  const networthTrend = [
    ...historicalSnapshots,
    { month: lastDay, net_worth },
  ].sort( ( a, b ) => a.month.localeCompare( b.month ) );

  // Build spend-by-category from this month's debit transactions (used for budget alerts + summary)
  const spendByCategory: Record<string, number> = {};
  for ( const t of transactions ) {
    if ( t.cr_dr === 'debit' && !t.is_internal_transfer && t.category_id ) {
      spendByCategory[t.category_id] = ( spendByCategory[t.category_id] ?? 0 ) + Math.abs( t.amount_usd ?? 0 );
    }
  }

  const budgets = budgetsRes.data ?? [];

  const budgetSummary: BudgetSummaryItem[] = budgets
    .filter( ( b ) => ( b.amount_usd ?? 0 ) > 0 )
    .map( ( budget ) => {
      const categoryData = budget.category as { id: string; name: string } | null;
      const limit = budget.amount_usd ?? 0;
      const spent = spendByCategory[budget.category_id] ?? 0;
      const pct = Math.round( ( spent / limit ) * 100 );
      return { id: budget.id, categoryName: categoryData?.name ?? 'Unknown', limit, spent, pct };
    } )
    .sort( ( a, b ) => b.pct - a.pct );

  // ── Build actionable alerts ─────────────────────────────────────────────────
  const alerts: DashboardAlert[] = [];

  if ( budgets.length > 0 ) {
    for ( const budget of budgets ) {
      const categoryData = budget.category as { id: string; name: string } | null;
      const catName = categoryData?.name ?? 'Unknown';
      const catId = categoryData?.id ?? budget.category_id;
      const limit = budget.amount_usd ?? 0;
      if ( limit <= 0 ) continue;
      const spent = spendByCategory[budget.category_id] ?? 0;
      const pct = Math.round( ( spent / limit ) * 100 );
      const actionUrl = `/transactions?categoryId=${ catId }`;

      if ( pct >= 100 ) {
        alerts.push( {
          id: `budget_100_${ budget.id }`,
          type: 'budget_100',
          title: `Budget Exceeded: ${ catName }`,
          body: `Spent ${ formatCurrency( spent ) } of ${ formatCurrency( limit ) } budget — ${ pct }% used`,
          actionUrl,
          actionLabel: 'View Transactions',
        } );
      } else if ( pct >= 80 ) {
        alerts.push( {
          id: `budget_80_${ budget.id }`,
          type: 'budget_80',
          title: `Budget Alert: ${ catName }`,
          body: `Spent ${ formatCurrency( spent ) } of ${ formatCurrency( limit ) } budget — ${ pct }% used`,
          actionUrl,
          actionLabel: 'View Transactions',
        } );
      }
    }
  }

  // Flagged transaction alerts
  const flaggedTxns = flaggedTxnsRes.data ?? [];
  for ( const txn of flaggedTxns ) {
    alerts.push( {
      id: `anomaly_${ txn.id }`,
      type: 'anomaly',
      title: 'Flagged Transaction',
      body: `Unusual transaction: "${ txn.description }" — ${ formatCurrency( Math.abs( txn.amount_usd ?? 0 ) ) }`,
      actionUrl: `/transactions`,
      actionLabel: 'See Transactions',
    } );
  }

  // Upcoming bill alerts (limited to 7-day window)
  for ( const bill of bills.filter( b => {
    const due = new Date( b.next_billing_date! );
    return due.getTime() - today.getTime() <= 7 * 24 * 60 * 60 * 1000;
  } ) ) {
    const due = new Date( bill.next_billing_date! );
    const diffMs = due.getTime() - today.getTime();
    const daysUntil = Math.ceil( diffMs / ( 1000 * 60 * 60 * 24 ) );
    alerts.push( {
      id: `bill_${ bill.name }_${ bill.next_billing_date }`,
      type: 'upcoming_bill',
      title: `Upcoming Bill: ${ bill.name }`,
      body: `Due in ${ daysUntil } day${ daysUntil !== 1 ? 's' : '' } — ${ formatCurrency( bill.billing_cost ?? 0 ) }`,
      actionUrl: `/subscriptions`,
      actionLabel: 'View Subscriptions',
    } );
  }

  // Overdue bill alerts
  for ( const bill of overdueBills ) {
    const due = new Date( bill.next_billing_date! );
    const daysOverdue = Math.ceil( ( today.getTime() - due.getTime() ) / ( 1000 * 60 * 60 * 24 ) );
    alerts.push( {
      id: `bill_overdue_${ bill.name }_${ bill.next_billing_date }`,
      type: 'upcoming_bill',
      title: `Overdue Bill: ${ bill.name }`,
      body: `${ daysOverdue } day${ daysOverdue !== 1 ? 's' : '' } past due — ${ formatCurrency( bill.billing_cost ?? 0 ) }`,
      actionUrl: `/subscriptions`,
      actionLabel: 'View Subscriptions',
    } );
  }

  const recentTransactions: Transaction[] = ( recentTxnsRes.data ?? [] ).map( ( t: Record<string, unknown> ) => ( {
    id: t.id as string,
    description: t.description as string,
    final_amount: t.final_amount as number,
    date: t.date as string,
    flagged: t.flagged as boolean,
    categories: t.categories as { name: string; id: string } | null,
    accounts: t.accounts as { name: string } | null,
  } ) );

  // Cash flow projection (only meaningful for current month)
  const daysInMonth = new Date( viewDate.getFullYear(), viewDate.getMonth() + 1, 0 ).getDate();
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

  // Smarter projection: blend current actuals with 3-month rolling average daily rate
  let projectedExpenses = monthly_expenses;
  if ( isCurrentMonth && daysElapsed > 0 ) {
    const daysRemaining = daysInMonth - daysElapsed;
    // Last 3 complete months before the current month (monthlyData[-4..-1])
    const completedMonths = monthlyData.slice( -4, -1 );
    const validMonths = completedMonths.filter( m => m.expenses > 0 );
    if ( validMonths.length > 0 ) {
      const avgDailyFromHistory = validMonths.reduce( ( s, m ) => {
        const d = new Date( m.month + '-01' );
        const daysInThatMonth = new Date( d.getFullYear(), d.getMonth() + 1, 0 ).getDate();
        return s + ( m.expenses / daysInThatMonth );
      }, 0 ) / validMonths.length;
      projectedExpenses = Math.round( monthly_expenses + ( avgDailyFromHistory * daysRemaining ) );
    } else {
      // Fallback: linear extrapolation
      projectedExpenses = Math.round( ( monthly_expenses / daysElapsed ) * daysInMonth );
    }
  }

  // Months that have at least one transaction — used by the MonthSelector
  const _currentMonthKey = `${ today.getFullYear() }-${ pad( today.getMonth() + 1 ) }`;
  const availableMonthsSet = new Set<string>( ( twelveMonthTxnsRes.data ?? [] ).map( t => ( t.date as string ).substring( 0, 7 ) ) );
  availableMonthsSet.add( _currentMonthKey ); // always include current month
  const availableMonths = Array.from( availableMonthsSet ).sort( ( a, b ) => b.localeCompare( a ) );

  return {
    net_worth, total_assets, total_liabilities,
    monthly_income, monthly_expenses, savings_rate,
    flagged_count, upcoming_bills,
    networth_trend: networthTrend,
    categoryBreakdown, monthlyData, categoryMonthlyData,
    recentTransactions,
    alerts,
    hasAccounts: accounts.length > 0,
    budgetSummary,
    projectedExpenses,
    daysElapsed,
    daysInMonth,
    isCurrentMonth,
    availableMonths,
    selectedMonth: firstDay,
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage ( { searchParams }: { searchParams: Promise<{ month?: string }> } ) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if ( !user ) redirect( '/login' );

  const params = await searchParams;
  const monthParam = params?.month;

  // Derive selectedMonth for display ("YYYY-MM")
  const _now = new Date();
  const currentMonth = `${ _now.getFullYear() }-${ String( _now.getMonth() + 1 ).padStart( 2, '0' ) }`;
  const selectedMonth = monthParam ?? currentMonth;

  const data = await getDashboardData( user.id, monthParam );

  // Sparkline data — last 6 months
  const incomeSparkline = data.monthlyData.slice( -6 ).map( d => d.income );
  const expensesSparkline = data.monthlyData.slice( -6 ).map( d => d.expenses );
  const networthSparkline = data.networth_trend.slice( -6 ).map( d => d.net_worth );
  const savingsRateSparkline = data.monthlyData.slice( -6 ).map( d =>
    d.income > 0 ? ( ( d.income - d.expenses ) / d.income ) * 100 : 0
  );

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString( "en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        } )}
        tooltip={
          <HelpModal
            title="Dashboard"
            description="Your financial command center. Get a real-time snapshot of your net worth, monthly cash flow, upcoming bills, and AI-generated daily insights — all in one place."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Review your net worth and monthly income/expense summary at a glance",
                  "Check the spending breakdown chart to see where money is going by category",
                  "Monitor upcoming bills so nothing catches you by surprise",
                  "Read the daily AI insight for a personalized financial tip",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Navigate to Transactions to add or review individual entries",
                  "Go to Budgets to set monthly spending limits per category",
                  "Visit Accounts to update balances or add new accounts",
                ],
              },
            ]}
          />
        }
      >
        <MonthSelector selectedMonth={selectedMonth} availableMonths={data.availableMonths} />
        <Button variant="secondary" size="sm">
          <Bell className="h-3.5 w-3.5 mr-1.5" />
          {data.flagged_count} alerts
        </Button>
        <Link href="/transactions">
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="inline">Add Transaction</span>
          </Button>
        </Link>
      </PageHeader>

      {/* Welcome banner — only for new users with no accounts */}
      {!data.hasAccounts && <DashboardWelcomeBanner />}

      {/* Past month indicator */}
      {!data.isCurrentMonth && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 text-sm text-[var(--color-warning)]">
          <span className="font-medium">Viewing historical data</span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <Link href="/dashboard" className="underline underline-offset-2 hover:no-underline">
            Back to current month
          </Link>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Net Worth"
          value={formatCurrency( data.net_worth )}
          positive={data.net_worth >= 0}
          href="/accounts"
          sparklineData={networthSparkline}
        />
        <MetricCard
          label="Monthly Income"
          value={formatCurrency( data.monthly_income )}
          href="/paychecks"
          sparklineData={incomeSparkline}
        />
        <MetricCard
          label="Monthly Expenses"
          value={formatCurrency( data.monthly_expenses )}
          href="/budgets"
          sparklineData={expensesSparkline}
          projectedValue={
            data.isCurrentMonth && data.projectedExpenses !== data.monthly_expenses
              ? `Projected: ${formatCurrency( data.projectedExpenses )} · ${data.daysElapsed}/${data.daysInMonth} days`
              : undefined
          }
        />
        <MetricCard
          label="Savings Rate"
          value={`${ data.savings_rate.toFixed( 1 ) }%`}
          positive={data.savings_rate >= 0}
          href="/budgets"
          sparklineData={savingsRateSparkline}
        />
      </div>

      {/* AI Insight Card — streams in without blocking page render */}
      <Suspense fallback={null}>
        <DashboardInsightLoader
          userId={user.id}
          netWorth={data.net_worth}
          monthlyIncome={data.monthly_income}
          monthlyExpenses={data.monthly_expenses}
          flaggedCount={data.flagged_count}
          billsCount={data.upcoming_bills.length}
        />
      </Suspense>


      {/* Charts row — lazy-loaded to defer recharts from critical bundle */}
      <DashboardCharts
        categoryBreakdown={data.categoryBreakdown ?? []}
        monthlyData={data.monthlyData ?? []}
        networthTrend={data.networth_trend}
        categoryMonthlyData={data.categoryMonthlyData ?? {}}
        isNewUser={!data.hasAccounts}
        selectedMonth={data.selectedMonth}
      />

      {/* Budget progress bars */}
      {data.budgetSummary.length > 0 && (
        <BudgetProgressBars
          budgets={data.budgetSummary}
          selectedMonth={selectedMonth}
          isCurrentMonth={data.isCurrentMonth}
        />
      )}

      {/* Bottom row — three equal columns */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">

        {/* Recent Transactions */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <Link href="/transactions">
              <Button variant="ghost" size="sm">
                View all <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          {data.recentTransactions.length === 0 ? (
            <EmptySection
              icon={Receipt}
              title="No transactions yet"
              description="Your recent transactions will appear here once you add them."
              ctaLabel="Import transactions"
              ctaHref="/import"
            />
          ) : (
            <div className="overflow-y-auto max-h-72 pr-1 space-y-1">
              {data.recentTransactions.map( ( txn ) => {
                const isCredit = txn.final_amount > 0;
                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ isCredit ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]" }`}>
                        {isCredit ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1">
                          {txn.description}
                          {txn.flagged && <AlertTriangle className="h-3 w-3 shrink-0 text-[var(--color-warning)]" />}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate">
                          {txn.categories?.name ?? "Uncategorized"} · {formatDate( txn.date )}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium shrink-0 ml-2 ${ isCredit ? "text-[var(--color-success)]" : "text-[var(--color-danger)]" }`}>
                      {isCredit ? "+" : ""}{formatCurrency( txn.final_amount )}
                    </span>
                  </div>
                );
              } )}
            </div>
          )}
        </Card>

        {/* Upcoming Bills */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Upcoming Bills</CardTitle>
            <Link href="/subscriptions" aria-label="View all subscriptions">
              <Button variant="ghost" size="sm">
                View all <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          {data.upcoming_bills.length === 0 ? (
            <EmptySection
              icon={CalendarClock}
              title="No upcoming bills"
              description="Track subscriptions and recurring bills to see them here."
              ctaLabel="Add subscription"
              ctaHref="/subscriptions"
            />
          ) : ( () => {
            const overdueBillsList = data.upcoming_bills.filter( b => b.overdue );
            const thisWeekBills = data.upcoming_bills.filter( b => !b.overdue && getDaysUntilDue( b.due_date ) <= 7 );
            const laterBills = data.upcoming_bills.filter( b => !b.overdue && getDaysUntilDue( b.due_date ) > 7 );

            const BillRow = ( { bill, urgency }: { bill: typeof data.upcoming_bills[0]; urgency: 'danger' | 'warning' | 'normal' } ) => (
              <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {urgency !== 'normal' && (
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${ urgency === 'danger' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-warning)]' }`} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{bill.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      { bill.overdue ? `${ Math.abs( getDaysUntilDue( bill.due_date ) ) }d overdue`
                        : getDaysUntilDue( bill.due_date ) === 0 ? 'Due today'
                        : `Due ${ formatDate( bill.due_date ) }` }
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-medium shrink-0 ml-2 ${ urgency === 'danger' ? 'text-[var(--color-danger)]' : '' }`}>
                  {formatCurrency( bill.amount )}
                </span>
              </div>
            );

            return (
              <div className="overflow-y-auto max-h-72 pr-1 space-y-4">
                {overdueBillsList.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-danger)] uppercase tracking-wider mb-2">Overdue</p>
                    {overdueBillsList.map( ( bill, i ) => <BillRow key={i} bill={bill} urgency="danger" /> )}
                  </div>
                )}
                {thisWeekBills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wider mb-2">This Week</p>
                    {thisWeekBills.map( ( bill, i ) => <BillRow key={i} bill={bill} urgency="warning" /> )}
                  </div>
                )}
                {laterBills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Later</p>
                    {laterBills.map( ( bill, i ) => <BillRow key={i} bill={bill} urgency="normal" /> )}
                  </div>
                )}
              </div>
            );
          } )() }
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Total (30 days)</span>
              <span className="font-medium">{formatCurrency( data.upcoming_bills.reduce( ( s, b ) => s + b.amount, 0 ) )}</span>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <div className="space-y-4">

            {/* Balance */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Balance</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Total assets</span>
                  <span className="font-medium">{formatCurrency( data.total_assets )}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Total liabilities</span>
                  <span className="font-medium text-[var(--color-danger)]">{formatCurrency( data.total_liabilities )}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Monthly savings</span>
                  <span className={`font-medium ${ ( data.monthly_income - data.monthly_expenses ) >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]" }`}>
                    {formatCurrency( data.monthly_income - data.monthly_expenses )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Savings rate</span>
                  <span className={`font-medium ${ data.savings_rate >= 20 ? "text-[var(--color-success)]" : data.savings_rate >= 0 ? "" : "text-[var(--color-danger)]" }`}>
                    {data.savings_rate.toFixed( 1 )}%
                  </span>
                </div>
              </div>
            </div>

            {/* Bills */}
            <div className="pt-3 border-t border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Bills</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Overdue</span>
                  <span className={`font-medium ${ data.upcoming_bills.filter( b => b.overdue ).length > 0 ? "text-[var(--color-danger)]" : "" }`}>
                    {data.upcoming_bills.filter( b => b.overdue ).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Due this week</span>
                  <span className={`font-medium ${ data.upcoming_bills.filter( b => !b.overdue && getDaysUntilDue( b.due_date ) <= 7 ).length > 0 ? "text-[var(--color-warning)]" : "" }`}>
                    {data.upcoming_bills.filter( b => !b.overdue && getDaysUntilDue( b.due_date ) <= 7 ).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Next 30 days</span>
                  <span className="font-medium">{data.upcoming_bills.filter( b => !b.overdue ).length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Total upcoming</span>
                  <span className="font-medium">{formatCurrency( data.upcoming_bills.reduce( ( s, b ) => s + b.amount, 0 ) )}</span>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="pt-3 border-t border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Activity</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Flagged transactions</span>
                  <Link href="/transactions?flagged=true" className={`font-medium ${ data.flagged_count > 0 ? "text-[var(--color-warning)] hover:underline" : "" }`}>
                    {data.flagged_count}
                  </Link>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Active alerts</span>
                  <span className={`font-medium ${ data.alerts.length > 0 ? "text-[var(--color-warning)]" : "" }`}>
                    {data.alerts.length}
                  </span>
                </div>
                { data.categoryBreakdown[0] && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Top spending</span>
                    <span className="font-medium truncate max-w-[130px] text-right">{data.categoryBreakdown[0].name}</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </Card>

      </div>
    </div>
  );
}
