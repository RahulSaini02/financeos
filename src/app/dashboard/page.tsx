"use client";

import { useEffect, useState } from "react";
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
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";
import { MonthComparisonChart } from "@/components/charts/month-comparison-chart";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpcomingBill {
  name: string;
  due_date: string;
  amount: number;
  paid: boolean;
}

interface NetworthPoint {
  month: string;
  net_worth: number;
}

interface LatestInsight {
  content: string;
  type: string;
}

interface CategoryBreakdown {
  name: string;
  amount: number;
  color: string;
}

interface MonthlyDataPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
}

interface DashboardData {
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  monthly_income: number;
  monthly_expenses: number;
  savings_rate: number;
  flagged_count: number;
  upcoming_bills: UpcomingBill[];
  networth_trend: NetworthPoint[];
  latest_insight: LatestInsight | null;
  categoryBreakdown: CategoryBreakdown[];
  monthlyData: MonthlyDataPoint[];
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage () {
  const { user } = useAuth();
  const _supabase = createClient();

  const [data, setData] = useState<DashboardData | null>( null );
  const [transactions, setTransactions] = useState<Transaction[]>( [] );
  const [loading, setLoading] = useState( true );
  const [error, setError] = useState<string | null>( null );

  useEffect( () => {
    if ( !user ) return;

    async function fetchAll () {
      setLoading( true );
      setError( null );
      try {
        const [dashRes, txnRes] = await Promise.all( [
          fetch( "/api/dashboard" ),
          fetch( "/api/transactions?limit=5" ),
        ] );

        if ( !dashRes.ok ) {
          throw new Error( `Dashboard fetch failed: ${ dashRes.status }` );
        }

        const dashJson: DashboardData = await dashRes.json();
        setData( dashJson );

        if ( txnRes.ok ) {
          const txnJson = await txnRes.json();
          setTransactions( Array.isArray( txnJson ) ? txnJson : txnJson.data ?? [] );
        }
      } catch ( err ) {
        setError( err instanceof Error ? err.message : "Failed to load dashboard data" );
      } finally {
        setLoading( false );
      }
    }

    fetchAll();
  }, [user] );

  if ( loading ) return <DashboardSkeleton />;

  if ( error || !data ) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-danger)]">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">{error ?? "Failed to load dashboard"}</p>
        </div>
      </div>
    );
  }

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

      {/* AI Insight Card */}
      {data.latest_insight && (
        <Card className="border-[var(--color-accent)] bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">AI Insight</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {data.latest_insight.content}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
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
            {transactions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No recent transactions.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map( ( txn ) => {
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

      {/* Charts row — Category pie + Month comparison + Net Worth Trend */}
      <div className="grid gap-6 lg:grid-cols-3">
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
    </div>
  );
}
