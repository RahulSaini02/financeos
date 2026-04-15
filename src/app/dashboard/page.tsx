import { redirect } from "next/navigation";
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
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { MonthComparisonChart } from "@/components/charts/month-comparison-chart";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { InsightExpander } from "@/components/dashboard/InsightExpander";
import Anthropic from "@anthropic-ai/sdk";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpcomingBill {
  name: string;
  due_date: string;
  amount: number;
  paid: boolean;
}

interface Transaction {
  id: string;
  description: string;
  final_amount: number;
  date: string;
  flagged: boolean;
  categories?: { name: string } | null;
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

// ── MetricCard sub-component ───────────────────────────────────────────────────

function MetricCard ( {
  label,
  value,
  change,
  changeLabel,
  positive,
  href
}: {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  positive?: boolean;
  href?: string;
} ) {
  const content = (
    <Card className={`hover:border-[var(--color-accent)] transition-colors cursor-pointer`}>
      <CardTitle>{label}</CardTitle>
      <CardValue className={`mt-2`}>{value}</CardValue>
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

async function getDashboardData ( userId: string ) {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const pad = ( n: number ) => String( n ).padStart( 2, '0' );
  const firstDay = `${ now.getFullYear() }-${ pad( now.getMonth() + 1 ) }-01`;
  const lastDay = new Date( now.getFullYear(), now.getMonth() + 1, 0 ).toISOString().split( 'T' )[0];
  const todayStr = now.toISOString().split( 'T' )[0];
  const sevenDaysFromNow = new Date( now );
  sevenDaysFromNow.setDate( sevenDaysFromNow.getDate() + 7 );
  const sevenDaysStr = sevenDaysFromNow.toISOString().split( 'T' )[0];

  const prevMonthDate = new Date( now.getFullYear(), now.getMonth() - 1, 1 );
  const prevMonthFirstDay = `${ prevMonthDate.getFullYear() }-${ pad( prevMonthDate.getMonth() + 1 ) }-01`;
  const prevMonthLastDay = new Date( now.getFullYear(), now.getMonth(), 0 ).toISOString().split( 'T' )[0];
  const twelveMonthsAgoDate = new Date( now.getFullYear(), now.getMonth() - 11, 1 );
  const twelveMonthsAgoStr = `${ twelveMonthsAgoDate.getFullYear() }-${ pad( twelveMonthsAgoDate.getMonth() + 1 ) }-01`;

  const [
    accountsRes, transactionsRes, flaggedRes, networthRes,
    insightRes, billsRes, prevTransactionsRes, twelveMonthTxnsRes, recentTxnsRes,
    budgetsRes, flaggedTxnsRes,
  ] = await Promise.all( [
    supabase.from( 'accounts' ).select( '*' ).eq( 'user_id', userId ).eq( 'is_active', true ),
    supabase.from( 'transactions' ).select( '*, category:categories(name, id)' ).eq( 'user_id', userId ).gte( 'date', firstDay ).lte( 'date', lastDay ),
    supabase.from( 'transactions' ).select( '*', { count: 'exact', head: true } ).eq( 'user_id', userId ).eq( 'flagged', true ),
    supabase.from( 'networth_snapshots' ).select( '*' ).eq( 'user_id', userId ).order( 'month', { ascending: false } ).limit( 12 ),
    supabase.from( 'ai_insights' ).select( '*' ).eq( 'user_id', userId ).eq( 'is_read', false ).order( 'created_at', { ascending: false } ).limit( 1 ),
    supabase.from( 'subscriptions' ).select( 'name, next_billing_date, billing_cost' ).eq( 'user_id', userId ).eq( 'status', 'active' ).not( 'next_billing_date', 'is', null ).gte( 'next_billing_date', todayStr ).lte( 'next_billing_date', sevenDaysStr ).order( 'next_billing_date', { ascending: true } ),
    supabase.from( 'transactions' ).select( 'amount_usd, cr_dr, is_internal_transfer' ).eq( 'user_id', userId ).gte( 'date', prevMonthFirstDay ).lte( 'date', prevMonthLastDay ),
    supabase.from( 'transactions' ).select( 'amount_usd, cr_dr, date' ).eq( 'user_id', userId ).eq( 'is_internal_transfer', false ).gte( 'date', twelveMonthsAgoStr ).lte( 'date', lastDay ),
    supabase.from( 'transactions' ).select( 'id, description, final_amount, date, flagged, categories(name), accounts(name)' ).eq( 'user_id', userId ).order( 'date', { ascending: false } ).limit( 5 ),
    supabase.from( 'budgets' ).select( '*, category:categories(id, name)' ).eq( 'user_id', userId ).eq( 'month', firstDay ),
    supabase.from( 'transactions' ).select( 'id, description, amount_usd, date' ).eq( 'user_id', userId ).eq( 'flagged', true ).order( 'date', { ascending: false } ).limit( 5 ),
  ] );

  const accounts = accountsRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const flagged_count = flaggedRes.count ?? 0;
  const snapshots = networthRes.data ?? [];
  let latest_insight = insightRes.data?.[0] ?? null;
  const bills = billsRes.data ?? [];

  const total_assets = accounts.filter( ( a ) => a.kind === 'asset' || a.kind === 'investment' ).reduce( ( s, a ) => s + ( a.current_balance ?? 0 ), 0 );
  const total_liabilities = accounts.filter( ( a ) => a.kind === 'liability' ).reduce( ( s, a ) => s + Math.abs( a.current_balance ?? 0 ), 0 );
  const net_worth = total_assets - total_liabilities;

  const monthly_income = transactions.filter( ( t ) => t.cr_dr === 'credit' && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
  const monthly_expenses = transactions.filter( ( t ) => t.cr_dr === 'debit' && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
  const savings_rate = monthly_income > 0 ? ( ( monthly_income - monthly_expenses ) / monthly_income ) * 100 : 0;

  const upcoming_bills: UpcomingBill[] = bills.map( ( b ) => ( { name: b.name, due_date: b.next_billing_date, amount: b.billing_cost, paid: false } ) );

  // Category breakdown
  const catSpend: Record<string, number> = {};
  for ( const t of transactions ) {
    if ( t.cr_dr === 'debit' && !t.is_internal_transfer ) {
      const catName = ( t.category as unknown as { name: string } | null )?.name ?? 'Uncategorized';
      catSpend[catName] = ( catSpend[catName] ?? 0 ) + Math.abs( t.amount_usd ?? 0 );
    }
  }
  const sortedCats = Object.entries( catSpend ).sort( ( a, b ) => b[1] - a[1] );
  const top6 = sortedCats.slice( 0, 6 );
  const otherTotal = sortedCats.slice( 6 ).reduce( ( s, [, v] ) => s + v, 0 );
  const categoryBreakdown = [
    ...top6.map( ( [name, amount], i ) => ( { name, amount, color: CATEGORY_COLORS[i] } ) ),
    ...( otherTotal > 0 ? [{ name: 'Other', amount: otherTotal, color: CATEGORY_COLORS[6] }] : [] ),
  ];

  // 12-month comparison
  const monthMap: Record<string, { income: number; expenses: number }> = {};
  for ( const t of twelveMonthTxnsRes.data ?? [] ) {
    const key = ( t.date as string ).substring( 0, 7 );
    if ( !monthMap[key] ) monthMap[key] = { income: 0, expenses: 0 };
    if ( t.cr_dr === 'credit' ) monthMap[key].income += Math.abs( t.amount_usd ?? 0 );
    else monthMap[key].expenses += Math.abs( t.amount_usd ?? 0 );
  }
  const monthlyData = Array.from( { length: 12 }, ( _, i ) => {
    const d = new Date( now.getFullYear(), now.getMonth() - ( 11 - i ), 1 );
    const key = `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }`;
    const label = d.toLocaleDateString( 'en-US', { month: 'short', year: '2-digit' } );
    return { month: key, label, income: Math.round( ( monthMap[key]?.income ?? 0 ) * 100 ) / 100, expenses: Math.round( ( monthMap[key]?.expenses ?? 0 ) * 100 ) / 100 };
  } );

  // AI daily insight — generate once per day
  const hasInsightToday = latest_insight && latest_insight.created_at.startsWith( todayStr );
  if ( !hasInsightToday && process.env.ANTHROPIC_API_KEY ) {
    try {
      const anthropic = new Anthropic( { apiKey: process.env.ANTHROPIC_API_KEY } );
      const savingsRate = monthly_income > 0 ? ( ( monthly_income - monthly_expenses ) / monthly_income * 100 ).toFixed( 1 ) : '0';
      const msg = await anthropic.messages.create( {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: `You are a personal finance assistant. Generate a single concise daily financial insight (2-3 sentences max) based on this data:\n- Net worth: $${ net_worth.toFixed( 2 ) }\n- This month income: $${ monthly_income.toFixed( 2 ) }, expenses: $${ monthly_expenses.toFixed( 2 ) }, savings rate: ${ savingsRate }%\n- Flagged transactions: ${ flagged_count }\n- Upcoming bills in 7 days: ${ bills.length }\nBe specific, actionable, and encouraging. Do not use markdown. Do not start with "Based on" or "Your data shows".` }],
      } );
      const insightText = msg.content[0].type === 'text' ? msg.content[0].text : null;
      if ( insightText ) {
        const { data: newInsight } = await supabase.from( 'ai_insights' ).insert( { user_id: userId, type: 'daily', content: insightText, month: firstDay, is_read: false } ).select().single();
        if ( newInsight ) latest_insight = newInsight;
      }
    } catch { /* non-fatal */ }
  }

  // Monthly summary — once per month
  if ( process.env.ANTHROPIC_API_KEY ) {
    try {
      const { data: existing } = await supabase.from( 'ai_insights' ).select( 'id' ).eq( 'user_id', userId ).eq( 'type', 'monthly' ).eq( 'month', firstDay ).limit( 1 );
      if ( !existing || existing.length === 0 ) {
        const prevTransactions = prevTransactionsRes.data ?? [];
        if ( prevTransactions.length > 0 ) {
          const prevIncome = prevTransactions.filter( ( t ) => t.cr_dr === 'credit' && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
          const prevExpenses = prevTransactions.filter( ( t ) => t.cr_dr === 'debit' && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
          const prevSavingsRate = prevIncome > 0 ? ( ( prevIncome - prevExpenses ) / prevIncome * 100 ).toFixed( 1 ) : '0';
          const anthropic = new Anthropic( { apiKey: process.env.ANTHROPIC_API_KEY } );
          const summaryMsg = await anthropic.messages.create( { model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: `Generate a concise monthly financial summary for ${ prevMonthDate.toLocaleDateString( 'en-US', { month: 'long', year: 'numeric' } ) }. Data:\n- Income: $${ prevIncome.toFixed( 2 ) }, Expenses: $${ prevExpenses.toFixed( 2 ) }, Savings rate: ${ prevSavingsRate }%\nWrite 3-4 sentences covering performance and one actionable suggestion. No markdown.` }] } );
          const summaryText = summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : null;
          if ( summaryText ) await supabase.from( 'ai_insights' ).insert( { user_id: userId, type: 'monthly', content: summaryText, month: firstDay, is_read: false } );
        }
      }
    } catch { /* non-fatal */ }
  }

  // Upsert net worth snapshot
  await supabase.from( 'networth_snapshots' ).upsert( { user_id: userId, month: lastDay, assets_total: total_assets, liabilities_total: total_liabilities, net_worth }, { onConflict: 'user_id,month' } );

  // ── Build actionable alerts ─────────────────────────────────────────────────
  const alerts: DashboardAlert[] = [];

  // Budget alerts: compute spend per category from this month's debit transactions
  const budgets = budgetsRes.data ?? [];
  if ( budgets.length > 0 ) {
    // Build a category_id → spend map from already-fetched transactions
    const spendByCategory: Record<string, number> = {};
    for ( const t of transactions ) {
      if ( t.cr_dr === 'debit' && !t.is_internal_transfer && t.category_id ) {
        spendByCategory[t.category_id] = ( spendByCategory[t.category_id] ?? 0 ) + Math.abs( t.amount_usd ?? 0 );
      }
    }

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

  // Upcoming bill alerts (from bills already fetched, limited to 7-day window)
  for ( const bill of bills ) {
    const now2 = new Date();
    const due = new Date( bill.next_billing_date );
    const diffMs = due.getTime() - now2.getTime();
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

  const recentTransactions: Transaction[] = ( recentTxnsRes.data ?? [] ).map( ( t: Record<string, unknown> ) => ( {
    id: t.id as string,
    description: t.description as string,
    final_amount: t.final_amount as number,
    date: t.date as string,
    flagged: t.flagged as boolean,
    categories: t.categories as { name: string } | null,
    accounts: t.accounts as { name: string } | null,
  } ) );

  return {
    net_worth, total_assets, total_liabilities,
    monthly_income, monthly_expenses, savings_rate,
    flagged_count, upcoming_bills,
    networth_trend: [...snapshots].reverse(),
    latest_insight,
    categoryBreakdown, monthlyData,
    recentTransactions,
    alerts,
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage () {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if ( !user ) redirect( '/login' );

  const data = await getDashboardData( user.id );

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

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Net Worth"
          value={formatCurrency( data.net_worth )}
          positive={data.net_worth >= 0}
          href="/accounts"
        />
        <MetricCard
          label="Monthly Income"
          value={formatCurrency( data.monthly_income )}
          href="/paychecks"
        />
        <MetricCard
          label="Monthly Expenses"
          value={formatCurrency( data.monthly_expenses )}
          href="/budgets"
        />
        <MetricCard
          label="Savings Rate"
          value={`${ data.savings_rate.toFixed( 1 ) }%`}
          positive={data.savings_rate >= 0}
          href="/budgets"
        />
      </div>

      {/* AI Insight Card */}
      {data.latest_insight && (
        <Card className="border-[var(--color-accent)] bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">AI Insight</p>
              <div className="mt-1">
                <InsightExpander content={data.latest_insight.content} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <span className="text-xs text-[var(--color-text-muted)]">
            {data.alerts.length} active
          </span>
        </CardHeader>
        {data.alerts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No alerts — everything looks good.</p>
        ) : (
          <div className="space-y-3">
            {data.alerts.map( ( alert ) => {
              const isOver = alert.type === 'budget_100';
              const isRisk = alert.type === 'budget_80';
              const isAnomaly = alert.type === 'anomaly';
              const isBill = alert.type === 'upcoming_bill';

              const iconBg = isOver
                ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                : isRisk
                  ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                  : isBill
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]';

              return (
                <div
                  key={alert.id}
                  className="flex items-start justify-between gap-3 py-2 border-b border-[var(--color-border)] last:border-0"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ iconBg }`}>
                      {( isOver || isRisk ) && <TrendingDown className="h-3.5 w-3.5" />}
                      {isAnomaly && <AlertTriangle className="h-3.5 w-3.5" />}
                      {isBill && <Bell className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{alert.body}</p>
                    </div>
                  </div>
                  <Link
                    href={alert.actionUrl}
                    className="shrink-0 text-xs text-[var(--color-accent)] hover:underline underline-offset-2 whitespace-nowrap"
                  >
                    {alert.actionLabel} →
                  </Link>
                </div>
              );
            } )}
          </div>
        )}
      </Card>

      {/* Charts row — Category pie + Month comparison + Net Worth Trend */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <CategoryPieChart
          data={( data.categoryBreakdown ?? [] ).map( ( d ) => ( {
            name: d.name,
            value: d.amount,
            color: d.color,
          } ) )}
        />
        <MonthComparisonChart monthlyData={data.monthlyData ?? []} />
        {data.networth_trend.length > 0 ? (
          <NetWorthChart points={data.networth_trend} />
        ) : (
          <div />
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <Link href="/transactions">
                <Button variant="ghost" size="sm">
                  View all <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            {data.recentTransactions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No recent transactions.</p>
            ) : (
              <div className="space-y-3">
                {data.recentTransactions.map( ( txn ) => {
                  const isCredit = txn.final_amount > 0;
                  return (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${ isCredit
                            ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                            : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                            }`}
                        >
                          {isCredit ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2">
                            {txn.description}
                            {txn.flagged && (
                              <AlertTriangle className="h-3 w-3 text-[var(--color-warning)]" />
                            )}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {txn.categories?.name ?? "Uncategorized"}
                            {txn.accounts?.name ? ` · ${ txn.accounts.name }` : ""}
                            {" · "}
                            {formatDate( txn.date )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium ${ isCredit
                          ? "text-[var(--color-success)]"
                          : "text-[var(--color-danger)]"
                          }`}
                      >
                        {isCredit ? "+" : ""}
                        {formatCurrency( txn.final_amount )}
                      </span>
                    </div>
                  );
                } )}
              </div>
            )}
          </Card>
        </div>

        {/* Upcoming Bills */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Bills</CardTitle>
              <Link href="/subscriptions">
                <Button variant="ghost" size="sm">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            {data.upcoming_bills.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No upcoming bills.</p>
            ) : (
              <div className="space-y-3">
                {data.upcoming_bills.map( ( bill, i ) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{bill.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Due {formatDate( bill.due_date )}
                      </p>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency( bill.amount )}
                    </span>
                  </div>
                ) )}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Total upcoming</span>
                <span className="font-medium">
                  {formatCurrency( data.upcoming_bills.reduce( ( s, b ) => s + b.amount, 0 ) )}
                </span>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Flagged transactions</span>
                <span className="font-medium text-[var(--color-warning)]">{data.flagged_count}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Total assets</span>
                <span className="font-medium">{formatCurrency( data.total_assets )}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Total liabilities</span>
                <span className="font-medium text-[var(--color-danger)]">
                  {formatCurrency( data.total_liabilities )}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
