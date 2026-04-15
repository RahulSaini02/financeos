"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  TrendingDown,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpModal } from "@/components/ui/help-modal";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface ReviewData {
  period: string;
  label: string;
  start: string;
  end: string;
  summary: {
    income: number;
    expenses: number;
    netCashFlow: number;
    netWorth: number;
    transactionCount: number;
  };
  topCategories: { name: string; amount: number; count: number }[];
  dailySpend: Record<string, number>;
  previousAvgDaily: number;
  analysis: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ") || line.startsWith("### ")) {
          return (
            <h3 key={i} className="font-semibold text-[var(--color-text-primary)] mt-4 mb-1 first:mt-0">
              {line.replace(/^#{2,3} /, "")}
            </h3>
          );
        }
        if (line.match(/^\*\*(.+)\*\*$/) || line.match(/^#+\s+\d+\.\s/)) {
          const content = line.replace(/^\*\*|\*\*$/g, "").replace(/^#+\s+\d+\.\s/, "");
          return (
            <p key={i} className="font-semibold text-[var(--color-text-primary)] mt-3 first:mt-0">
              {content}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ") || line.match(/^\d+\.\s/)) {
          const content = line.replace(/^[-•]\s|^\d+\.\s/, "");
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-[var(--color-accent)] shrink-0 mt-0.5 text-xs">▸</span>
              <span
                dangerouslySetInnerHTML={{
                  __html: content.replace(
                    /\*\*(.+?)\*\*/g,
                    '<strong class="text-[var(--color-text-primary)]">$1</strong>'
                  ),
                }}
              />
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return (
          <p
            key={i}
            dangerouslySetInnerHTML={{
              __html: line.replace(
                /\*\*(.+?)\*\*/g,
                '<strong class="text-[var(--color-text-primary)]">$1</strong>'
              ),
            }}
          />
        );
      })}
    </div>
  );
}

// ── Weekly bar chart (recharts) ─────────────────────────────────────────────────
function WeeklyBarTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const date = payload?.value ?? "";
  const dt = new Date(date + "T00:00:00");
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
  const md = dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#606070" fontSize={10}>
        {weekday}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill="#606070" fontSize={10}>
        {md}
      </text>
    </g>
  );
}

function WeeklyBarChart({
  dailySpend,
  start,
  end,
  previousAvgDaily,
}: {
  dailySpend: Record<string, number>;
  start: string;
  end: string;
  previousAvgDaily: number;
}) {
  const data: { date: string; amount: number }[] = [];
  const cur = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (cur <= endDate) {
    const key = cur.toISOString().split("T")[0];
    data.push({ date: key, amount: dailySpend[key] ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  if (data.length === 0) return <p className="text-sm text-[#606070]">No data</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
        <XAxis
          dataKey="date"
          tick={<WeeklyBarTick />}
          axisLine={false}
          tickLine={false}
          height={40}
        />
        <YAxis
          tick={{ fill: "#606070", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: "#18181f",
            border: "1px solid #2a2a3d",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#f0f0f5" }}
          labelFormatter={(label: unknown) => {
            const dt = new Date((label as string) + "T00:00:00");
            return dt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
          }}
          formatter={(v: unknown) => [fmtFull(v as number), "Spent"]}
          cursor={{ fill: "#222230" }}
        />
        <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={64} />
        {previousAvgDaily > 0 && (
          <ReferenceLine
            y={previousAvgDaily}
            stroke="#f59e0b"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{
              value: `Avg last week ${fmtFull(previousAvgDaily)}`,
              fill: "#f59e0b",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Monthly area chart (recharts) ───────────────────────────────────────────────
function MonthlyAreaChart({
  dailySpend,
  start,
  end,
  previousAvgDaily,
}: {
  dailySpend: Record<string, number>;
  start: string;
  end: string;
  previousAvgDaily: number;
}) {
  const data: { date: string; amount: number }[] = [];
  const cur = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (cur <= endDate) {
    const key = cur.toISOString().split("T")[0];
    data.push({ date: key, amount: dailySpend[key] ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  if (data.length === 0) return <p className="text-sm text-[#606070]">No data</p>;

  // Show only 1st, 8th, 15th, 22nd, and last day as ticks
  const tickDates = data
    .filter((d) => {
      const dayNum = new Date(d.date + "T00:00:00").getDate();
      return dayNum === 1 || dayNum === 8 || dayNum === 15 || dayNum === 22;
    })
    .map((d) => d.date);
  if (data.length > 0) tickDates.push(data[data.length - 1].date);

  const formatTick = (date: string) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="areaGradReview" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
        <XAxis
          dataKey="date"
          ticks={tickDates}
          tickFormatter={formatTick}
          tick={{ fill: "#606070", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#606070", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: "#18181f",
            border: "1px solid #2a2a3d",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#f0f0f5" }}
          labelFormatter={(label: unknown) => formatTick(label as string)}
          formatter={(v: unknown) => [fmtFull(v as number), "Spent"]}
          cursor={{ stroke: "#2a2a3d", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#areaGradReview)"
          dot={false}
          activeDot={{ r: 4, fill: "#6366f1", stroke: "#18181f", strokeWidth: 2 }}
        />
        {previousAvgDaily > 0 && (
          <ReferenceLine
            y={previousAvgDaily}
            stroke="#f59e0b"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{
              value: `Avg last month ${fmtFull(previousAvgDaily)}`,
              fill: "#f59e0b",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function InsightCards({ analysis }: { analysis: string }) {
  // Parse TLDR section (narrative text, not bullets)
  const tldrMatch = analysis.match(/##\s*TLDR[\s\S]*?(?=##|$)/i);
  const tldrText = tldrMatch
    ? tldrMatch[0]
        .split("\n")
        .slice(1)
        .filter((l) => l.trim() && !l.startsWith("##"))
        .join(" ")
        .trim()
    : null;

  // Parse bullet-point sections
  const sections = [
    { key: "Spending Insights", icon: "💡", color: "var(--color-accent)" },
    { key: "Budget Deviations", icon: "📊", color: "var(--color-warning)" },
    { key: "Alerts", icon: "⚠️", color: "var(--color-danger)" },
    { key: "Suggestions", icon: "✅", color: "var(--color-success)" },
  ];

  const parsed: { key: string; icon: string; color: string; items: string[] }[] = [];

  for (const sec of sections) {
    const regex = new RegExp(`##\\s*${sec.key}[\\s\\S]*?(?=##|$)`, "i");
    const match = analysis.match(regex);
    if (match) {
      const block = match[0];
      const items = block
        .split("\n")
        .filter((l) => l.match(/^[-•*]\s|^\d+\.\s/))
        .map((l) => l.replace(/^[-•*\d.]\s+/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
      if (items.length > 0) {
        parsed.push({ ...sec, items });
      }
    }
  }

  if (!tldrText && parsed.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* TLDR card — full width */}
      {tldrText && (
        <div className="col-span-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">TLDR</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{tldrText}</p>
        </div>
      )}

      {/* Bullet-point insight cards */}
      {parsed.map((sec) => (
        <div
          key={sec.key}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
          style={{ borderLeftWidth: 3, borderLeftColor: `color-mix(in srgb, ${sec.color} 60%, transparent)` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{sec.icon}</span>
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">{sec.key}</span>
          </div>
          <ul className="space-y-1">
            {sec.items.map((item, i) => (
              <li key={i} className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AiReviewPage() {
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-review?period=${period}`);
      if (!res.ok) throw new Error("Failed to load review");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const maxSpend = data
    ? Math.max(...data.topCategories.map((c) => c.amount), 1)
    : 1;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="AI Financial Review"
        subtitle={loading && !data ? "Loading…" : data?.label ?? ""}
        tooltip={
          <HelpModal
            title="AI Financial Review"
            description="Get a structured AI-powered review of your finances for the current week or month. Includes spending charts, top categories, budget deviations, anomaly alerts, and actionable suggestions."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Toggle between 'This Week' and 'This Month' to focus the analysis",
                  "Review the daily spending chart to spot unusual days",
                  "Read the AI analysis for personalized insights, alerts, and suggestions",
                  "Hit Refresh to regenerate the AI analysis with the latest data",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Week / Month toggle — change the analysis period",
                  "Refresh — pull fresh data and regenerate the AI narrative",
                  "Top Spending chart — see which categories consumed the most",
                  "AI Analysis — read structured insights, alerts, and suggestions",
                ],
              },
            ]}
          />
        }
      >
        <div className="flex w-full sm:w-auto gap-2">
          <div className="flex flex-1 sm:flex-none rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 sm:flex-none px-3 py-1.5 font-medium transition-colors ${
                  period === p
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                }`}
              >
                {p === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </PageHeader>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* ── Skeleton ───────────────────────────────────────────── */}
      {loading && !data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
            ))}
          </div>
          <div className="h-56 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-48 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
            <div className="h-48 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
          </div>
        </div>
      )}

      {data && (
        <>
          {/* ── Summary strip ─────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Income */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-success)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Income</span>
              </div>
              <p className="text-xl font-bold text-[var(--color-success)]">{fmt(data.summary.income)}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{data.summary.transactionCount} transactions</p>
            </div>

            {/* Expenses */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownRight className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Expenses</span>
              </div>
              <p className="text-xl font-bold text-[var(--color-danger)]">{fmt(data.summary.expenses)}</p>
            </div>

            {/* Net cash flow */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Minus className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Net Cash Flow</span>
              </div>
              <p className={`text-xl font-bold ${data.summary.netCashFlow >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {data.summary.netCashFlow >= 0 ? "+" : "-"}{fmt(Math.abs(data.summary.netCashFlow))}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {data.summary.netCashFlow >= 0 ? "Surplus" : "Deficit"}
              </p>
            </div>

            {/* Net worth */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Net Worth</span>
              </div>
              <p className="text-xl font-bold text-[var(--color-text-primary)]">{fmt(data.summary.netWorth)}</p>
            </div>
          </div>

          {/* ── Insights at a Glance ──────────────────────────── */}
          {data.analysis && <InsightCards analysis={data.analysis} />}

          {/* ── Daily spending chart — full width ─────────────── */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--color-accent)]" />
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {period === "week" ? "Daily Spending" : "Daily Spending Trend"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {data.previousAvgDaily > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 border-t-2 border-dashed border-[#f59e0b]" />
                    <span className="text-[10px] text-[#f59e0b]">
                      {period === "week" ? "Last week avg" : "Last month avg"} {fmtFull(data.previousAvgDaily)}/day
                    </span>
                  </div>
                )}
                <span className="text-xs text-[var(--color-text-muted)]">{data.label}</span>
              </div>
            </div>
            <div className="overflow-x-auto min-w-0">
              {period === "week" ? (
                <WeeklyBarChart
                  dailySpend={data.dailySpend}
                  start={data.start}
                  end={data.end}
                  previousAvgDaily={data.previousAvgDaily}
                />
              ) : (
                <MonthlyAreaChart
                  dailySpend={data.dailySpend}
                  start={data.start}
                  end={data.end}
                  previousAvgDaily={data.previousAvgDaily}
                />
              )}
            </div>
          </div>

          {/* ── Two column: top spending + AI analysis ─────────── */}
          <div className="grid gap-6 lg:grid-cols-5 min-w-0">

            {/* Top spending */}
            <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-4 w-4 text-[var(--color-danger)]" />
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">Top Spending</span>
              </div>
              <div className="space-y-4">
                {data.topCategories.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">No expenses this period.</p>
                ) : (
                  data.topCategories.map((cat, i) => (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-[var(--color-text-muted)] w-4 shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm text-[var(--color-text-primary)] truncate">{cat.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0 ml-2">
                          {fmt(cat.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${(cat.amount / maxSpend) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{cat.count} txns</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI analysis */}
            <div className="lg:col-span-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)] p-4 sm:p-5 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-accent)]">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">AI Analysis</span>
                </div>
                {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--color-text-muted)]" />}
              </div>
              {data.analysis ? (
                <MarkdownRenderer text={data.analysis} />
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Configure <code className="text-xs bg-[var(--color-bg-tertiary)] px-1 rounded">ANTHROPIC_API_KEY</code> to enable AI analysis.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
