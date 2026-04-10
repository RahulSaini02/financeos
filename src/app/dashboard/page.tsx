"use client";

import { useEffect, useState, useId } from "react";
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
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

interface MonthComparison {
  lastMonth: { income: number; expenses: number };
  thisMonth: { income: number; expenses: number };
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
  monthComparison: MonthComparison;
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
  href,
}: {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  positive?: boolean;
  href?: string;
} ) {
  const content = (
    <Card className="hover:border-[var(--color-accent)] transition-colors cursor-pointer">
      <CardTitle>{label}</CardTitle>
      <CardValue className="mt-2">{value}</CardValue>
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

// ── NetWorthChart ──────────────────────────────────────────────────────────────

function NetWorthChart ( { points }: { points: NetworthPoint[] } ) {
  const [hovered, setHovered] = useState<number | null>( null );
  const uid = useId().replace( /:/g, "" );

  const W = 800;
  const H = 240;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 28;
  const PAD_B = 40;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const values = points.map( ( p ) => p.net_worth );
  const rawMin = Math.min( ...values );
  const rawMax = Math.max( ...values );
  const rawRange = rawMax - rawMin || Math.abs( rawMax ) || 1;

  const padFrac = 0.18;
  const yMin = rawMin - rawRange * padFrac;
  const yMax = rawMax + rawRange * padFrac;
  const yRange = yMax - yMin;

  const toX = ( i: number ) =>
    PAD_L + ( points.length === 1 ? chartW / 2 : ( i / ( points.length - 1 ) ) * chartW );
  const toY = ( val: number ) =>
    PAD_T + chartH - ( ( val - yMin ) / yRange ) * chartH;

  const coords = points.map( ( p, i ) => ( { x: toX( i ), y: toY( p.net_worth ) } ) );

  let linePath = "";
  let areaPath = "";
  if ( coords.length === 1 ) {
    linePath = `M ${ coords[0].x },${ coords[0].y }`;
  } else {
    linePath = `M ${ coords[0].x },${ coords[0].y }`;
    for ( let i = 1; i < coords.length; i++ ) {
      const px = coords[i - 1].x;
      const py = coords[i - 1].y;
      const cx = coords[i].x;
      const cy = coords[i].y;
      const cpx = ( px + cx ) / 2;
      linePath += ` C ${ cpx },${ py } ${ cpx },${ cy } ${ cx },${ cy }`;
    }
    const baseline = PAD_T + chartH;
    areaPath =
      linePath +
      ` L ${ coords[coords.length - 1].x },${ baseline } L ${ coords[0].x },${ baseline } Z`;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaPercent = first !== 0 ? ( delta / Math.abs( first ) ) * 100 : 0;
  const isUp = delta >= 0;

  const gridLines = [0.2, 0.5, 0.8].map( ( frac ) => ( {
    y: PAD_T + chartH * frac,
    val: yMax - frac * yRange,
  } ) );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Trend</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {points.length} month{points.length !== 1 ? "s" : ""}
          </span>
          {points.length > 1 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ isUp
                ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                }`}
            >
              {isUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isUp ? "+" : ""}
              {deltaPercent.toFixed( 1 )}%
            </span>
          )}
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {formatCurrency( last )}
          </span>
        </div>
      </CardHeader>

      <div
        className="relative mt-2"
        onMouseLeave={() => setHovered( null )}
      >
        <svg
          viewBox={`0 0 ${ W } ${ H }`}
          className="w-full overflow-visible"
          style={{ height: 220 }}
          aria-label="Net worth trend chart"
        >
          <defs>
            <linearGradient id={`grad-${ uid }`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`clip-${ uid }`}>
              <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
            </clipPath>
          </defs>

          {gridLines.map( ( { y, val } ) => (
            <g key={y}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="0.75"
                strokeDasharray="4 4"
              />
              <text
                x={PAD_L + 4}
                y={y - 5}
                fontSize="10"
                fill="var(--color-text-muted)"
                textAnchor="start"
              >
                {new Intl.NumberFormat( "en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 1,
                } ).format( val )}
              </text>
            </g>
          ) )}

          {yMin < 0 && yMax > 0 && ( () => {
            const zeroY = toY( 0 );
            return (
              <line
                x1={PAD_L}
                y1={zeroY}
                x2={W - PAD_R}
                y2={zeroY}
                stroke="var(--color-border)"
                strokeWidth="1"
              />
            );
          } )()}

          {hovered !== null && (
            <line
              x1={coords[hovered].x}
              y1={PAD_T}
              x2={coords[hovered].x}
              y2={PAD_T + chartH}
              stroke="var(--color-accent)"
              strokeWidth="1"
              strokeDasharray="4 3"
              strokeOpacity="0.5"
            />
          )}

          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#grad-${ uid })`}
              clipPath={`url(#clip-${ uid })`}
            />
          )}

          <path
            d={linePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath={`url(#clip-${ uid })`}
          />

          {coords.map( ( c, i ) => (
            <g key={i}>
              <rect
                x={c.x - ( i === 0 ? 0 : chartW / points.length / 2 )}
                y={PAD_T}
                width={chartW / points.length}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHovered( i )}
                style={{ cursor: "crosshair" }}
              />
              {hovered === i && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={10}
                  fill="var(--color-accent)"
                  fillOpacity="0.15"
                />
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r={hovered === i ? 5 : 3.5}
                fill={hovered === i ? "var(--color-accent)" : "var(--color-bg-secondary)"}
                stroke="var(--color-accent)"
                strokeWidth="2"
                style={{ transition: "r 0.1s, fill 0.1s" }}
              />
              <text
                x={c.x}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill={
                  hovered === i
                    ? "var(--color-text-primary)"
                    : "var(--color-text-muted)"
                }
                fontWeight={hovered === i ? "600" : "400"}
                style={{ transition: "fill 0.1s" }}
              >
                {new Date( points[i].month + "T00:00:00Z" ).toLocaleDateString(
                  "en-US",
                  { month: "short", year: "2-digit", timeZone: "UTC" }
                )}
              </text>
            </g>
          ) )}

          {hovered !== null && ( () => {
            const c = coords[hovered];
            const val = points[hovered].net_worth;
            const prevVal = hovered > 0 ? points[hovered - 1].net_worth : null;
            const mom = prevVal !== null ? val - prevVal : null;
            const TW = 150;
            const TH = mom !== null ? 52 : 36;
            const TX = Math.min( Math.max( c.x - TW / 2, PAD_L + 4 ), W - PAD_R - TW - 4 );
            const TY = Math.max( c.y - TH - 12, PAD_T );
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={TX}
                  y={TY}
                  width={TW}
                  height={TH}
                  rx="7"
                  fill="var(--color-bg-secondary)"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                  filter="drop-shadow(0 2px 8px rgba(0,0,0,0.12))"
                />
                <text
                  x={TX + TW / 2}
                  y={TY + 15}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="var(--color-text-muted)"
                >
                  {new Date( points[hovered].month + "T00:00:00Z" ).toLocaleDateString(
                    "en-US",
                    { month: "long", year: "numeric", timeZone: "UTC" }
                  )}
                </text>
                <text
                  x={TX + TW / 2}
                  y={TY + 31}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="var(--color-text-primary)"
                >
                  {formatCurrency( val )}
                </text>
                {mom !== null && (
                  <text
                    x={TX + TW / 2}
                    y={TY + 47}
                    textAnchor="middle"
                    fontSize="10"
                    fill={mom >= 0 ? "var(--color-success)" : "var(--color-danger)"}
                  >
                    {mom >= 0 ? "▲" : "▼"} {formatCurrency( Math.abs( mom ) )} mom
                  </text>
                )}
              </g>
            );
          } )()}
        </svg>
      </div>
    </Card>
  );
}

// ── CategoryPieChart ───────────────────────────────────────────────────────────

function CategoryPieChart ( { data }: { data: CategoryBreakdown[] } ) {
  if ( data.length === 0 ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <span className="text-xs text-[var(--color-text-muted)]">This month</span>
        </CardHeader>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">No expenses recorded yet.</p>
      </Card>
    );
  }

  const total = data.reduce( ( s, d ) => s + d.amount, 0 );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
        <span className="text-xs text-[var(--color-text-muted)]">This month · {formatCurrency( total )}</span>
      </CardHeader>
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={82}
              dataKey="amount"
              nameKey="name"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map( ( entry ) => (
                <Cell key={entry.name} fill={entry.color} />
              ) )}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#18181f",
                border: "1px solid #2a2a3d",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={( v: unknown ) => [
                `${ formatCurrency( v as number ) } (${ ( ( ( v as number ) / total ) * 100 ).toFixed( 1 ) }%)`,
                "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
          {data.map( ( cat ) => (
            <div key={cat.name} className="flex items-center gap-2 min-w-0">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: cat.color }}
              />
              <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1">
                {cat.name}
              </span>
              <span className="text-xs font-medium text-[var(--color-text-primary)] shrink-0">
                {formatCurrency( cat.amount )}
              </span>
            </div>
          ) )}
        </div>
      </div>
    </Card>
  );
}

// ── MonthComparisonChart ───────────────────────────────────────────────────────

function MonthComparisonChart ( { data }: { data: MonthComparison } ) {
  const now = new Date();
  const prevMonthName = new Date( now.getFullYear(), now.getMonth() - 1, 1 )
    .toLocaleDateString( "en-US", { month: "short" } );
  const thisMonthName = now.toLocaleDateString( "en-US", { month: "short" } );

  const chartData = [
    {
      name: prevMonthName,
      Income: Math.round( data.lastMonth.income ),
      Expenses: Math.round( data.lastMonth.expenses ),
    },
    {
      name: thisMonthName,
      Income: Math.round( data.thisMonth.income ),
      Expenses: Math.round( data.thisMonth.expenses ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Month Comparison</CardTitle>
        <span className="text-xs text-[var(--color-text-muted)]">Income vs Expenses</span>
      </CardHeader>
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#606070", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#606070", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={( v ) =>
                v >= 1000 ? `$${ ( v / 1000 ).toFixed( 0 ) }k` : `$${ v }`
              }
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#18181f",
                border: "1px solid #2a2a3d",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#f0f0f5", fontWeight: 600 }}
              formatter={( v: unknown, name: unknown ) => [formatCurrency( v as number ), name as string]}
              cursor={{ fill: "#222230" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#9090a0", paddingTop: 8 }}
            />
            <Bar dataKey="Income" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={56} />
            <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {new Date().toLocaleDateString( "en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            } )}
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

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
        <CategoryPieChart data={data.categoryBreakdown ?? []} />
        <MonthComparisonChart data={data.monthComparison ?? { lastMonth: { income: 0, expenses: 0 }, thisMonth: { income: data.monthly_income, expenses: data.monthly_expenses } }} />
        {data.networth_trend.length > 0 ? (
          <NetWorthChart points={data.networth_trend} />
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
