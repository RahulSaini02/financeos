"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Sparkles,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart2,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { HelpModal } from "@/components/ui/help-modal";
import { formatCurrency } from "@/lib/utils";
import { getDefaultPeriodKey, getPastPeriodKeys, periodInfo } from "@/lib/review-periods";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface TopCategory {
  name: string;
  amount: number;
  count: number;
  pctOfTotal: number;
  prevAmount: number | null;
  changePct: number | null;
}

export interface ReviewData {
  label: string;
  month: string;
  cached: boolean;
  hasPriorMonth: boolean;
  summary: {
    income: number;
    expenses: number;
    netCashFlow: number;
    transactionCount: number;
  };
  topCategories: TopCategory[];
  analysis: string;
}

const fmt = (n: number) => formatCurrency(n, 'USD', 0)

// ── Month-over-month grouped bar chart ────────────────────────────────────────
function MoMChart({ categories }: { categories: TopCategory[] }) {
  const data = categories
    .filter((c) => c.prevAmount != null)
    .slice(0, 6)
    .map((c) => ({
      name: c.name.length > 12 ? c.name.slice(0, 11) + "…" : c.name,
      thisMonth: Math.round(c.amount),
      lastMonth: Math.round(c.prevAmount ?? 0),
    }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 52 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#606070", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          height={54}
        />
        <YAxis
          tick={{ fill: "#606070", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: "#18181f",
            border: "1px solid #2a2a3d",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: unknown, name: unknown) => [
            fmt(v as number),
            name === "thisMonth" ? "This Period" : "Prior Period",
          ]}
        />
        <Legend
          formatter={(v) => (v === "thisMonth" ? "This Period" : "Prior Period")}
          wrapperStyle={{ fontSize: 11, color: "#c0c0d0", paddingTop: 8 }}
        />
        <Bar dataKey="lastMonth" fill="#374151" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="thisMonth" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AiReviewClient({
  initialData,
  availablePeriodKeys,
}: {
  initialData: ReviewData | null
  availablePeriodKeys: string[]
}) {
  // If the RPC returned nothing (migration not yet applied or new user),
  // fall back to generating the last 12 months from today's date.
  const periodKeys = useMemo(() => {
    if (availablePeriodKeys.length > 0) return availablePeriodKeys;
    const base = getDefaultPeriodKey(new Date());
    return [base, ...getPastPeriodKeys(base, 11)];
  }, [availablePeriodKeys]);

  const defaultKey = initialData?.month ?? periodKeys[0] ?? "";

  // Derive unique years (descending) from available keys
  const availableYears = useMemo(() => {
    const years = [...new Set(periodKeys.map((k) => k.slice(0, 4)))];
    return years.sort((a, b) => b.localeCompare(a));
  }, [periodKeys]);

  const defaultYear = availableYears[0] ?? String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<string>(defaultKey.slice(0, 4) || defaultYear);

  // Months available for the selected year
  const monthsForYear = useMemo(
    () => periodKeys.filter((k) => k.startsWith(selectedYear)),
    [periodKeys, selectedYear]
  );

  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(defaultKey);
  const [data, setData] = useState<ReviewData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false, periodKey?: string) => {
    const key = periodKey ?? selectedPeriodKey;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (force) params.set("force", "true");
      if (key) params.set("period", key);
      const res = await fetch(`/api/ai-review?${params}`);
      if (!res.ok) throw new Error("Failed to load review");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodKey]);

  // When year changes, reset month to the latest available in that year
  const handleYearChange = useCallback((year: string) => {
    setSelectedYear(year);
    const firstInYear = availablePeriodKeys.find((k) => k.startsWith(year));
    if (firstInYear) setSelectedPeriodKey(firstInYear);
  }, [availablePeriodKeys]);

  // On mount: fetch only if SSR didn't provide analysis
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!initialData || !initialData.analysis) {
      load(false, defaultKey);
    }
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the period selection changes (skip initial mount)
  useEffect(() => {
    if (!mountedRef.current) return;
    load(false, selectedPeriodKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodKey]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="AI Financial Review"
        subtitle={loading && !data ? "Loading…" : (data?.label ?? "Last Month")}
        tooltip={
          <HelpModal
            title="AI Financial Review"
            description="A monthly AI-powered analysis of your spending. Cached per month for instant access."
            sections={[
              {
                heading: "How it works",
                items: [
                  "Always shows the most recently completed full month",
                  "Use the month selector to browse past reviews",
                  "Compares the selected month vs the prior month for trend context",
                  "Hit Refresh to regenerate with the latest data at any time",
                ],
              },
            ]}
          />
        }
      >
        <button
          onClick={() => load(true, selectedPeriodKey)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </PageHeader>

      {/* ── Period filters ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">Period:</span>

        {/* Year */}
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            disabled={loading}
            className="appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 pr-7 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        </div>

        {/* Month */}
        <div className="relative">
          <select
            value={selectedPeriodKey}
            onChange={(e) => setSelectedPeriodKey(e.target.value)}
            disabled={loading}
            className="appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 pr-7 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            {monthsForYear.map((key) => (
              <option key={key} value={key}>
                {periodInfo(key).label.split(" ")[0]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* ── Regenerating banner (refresh in progress with existing data) ── */}
      {loading && data && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-2.5 text-sm text-[var(--color-accent)]">
          <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>Loading analysis…</span>
        </div>
      )}

      {/* ── Skeleton (only when loading with no existing data) ── */}
      {loading && !data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
          <div className="h-80 rounded-xl bg-[var(--color-bg-tertiary)] animate-pulse" />
        </div>
      )}

      {data && (
        <>
          {/* ── Summary strip — 2×2 mobile, 4-col desktop ────────── */}
          {(() => {
            const savingsRate =
              data.summary.income > 0
                ? (data.summary.netCashFlow / data.summary.income) * 100
                : 0;
            const savingsPositive = savingsRate >= 0;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Income */}
                <div className="rounded-xl border border-[var(--color-border)] border-l-2 border-l-[var(--color-success)] bg-[var(--color-bg-secondary)] p-5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-success)]" />
                    <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Income</span>
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-success)]">{fmt(data.summary.income)}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{data.summary.transactionCount} transactions</p>
                </div>

                {/* Expenses */}
                <div className="rounded-xl border border-[var(--color-border)] border-l-2 border-l-[var(--color-danger)] bg-[var(--color-bg-secondary)] p-5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ArrowDownRight className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                    <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Expenses</span>
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-danger)]">{fmt(data.summary.expenses)}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">&nbsp;</p>
                </div>

                {/* Net Cash Flow */}
                <div className="rounded-xl border border-[var(--color-border)] border-l-2 border-l-[var(--color-accent)] bg-[var(--color-bg-secondary)] p-5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Minus className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Net Cash Flow</span>
                  </div>
                  <p className={`text-2xl font-bold ${data.summary.netCashFlow >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {data.summary.netCashFlow >= 0 ? "+" : ""}{fmt(data.summary.netCashFlow)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {data.summary.netCashFlow >= 0 ? "Surplus" : "Deficit"}
                  </p>
                </div>

                {/* Savings Rate */}
                <div
                  className={`rounded-xl border border-[var(--color-border)] border-l-2 bg-[var(--color-bg-secondary)] p-5 ${
                    savingsPositive ? "border-l-purple-500" : "border-l-[var(--color-danger)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Savings Rate</span>
                  </div>
                  <p className={`text-2xl font-bold ${savingsPositive ? "text-purple-400" : "text-[var(--color-danger)]"}`}>
                    {savingsRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">of income</p>
                </div>
              </div>
            );
          })()}

          {/* ── AI Analysis ────────────────────────────────────── */}
          {data.analysis ? (
            <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--color-accent)]/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]/30">
                    <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">AI Analysis</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {data.label} • {data.cached ? "Cached" : "Generated now"}
                    </p>
                  </div>
                </div>
                {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--color-text-muted)]" />}
              </div>
              <MarkdownContent
                content={data.analysis}
                className="text-sm text-[var(--color-text-secondary)] leading-relaxed"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-muted)]">
              Configure{" "}
              <code className="text-xs bg-[var(--color-bg-tertiary)] px-1 rounded">ANTHROPIC_API_KEY</code>{" "}
              to enable AI analysis.
            </div>
          )}
          
          {/* ── Top Spending Breakdown ─────────────────────────── */}
          {data.topCategories.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[var(--color-border)]">
                <TrendingDown className="h-4 w-4 text-[var(--color-danger)]" />
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Top Spending — {data.label}
                </span>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left pb-2 pr-3 text-xs font-medium text-[var(--color-text-muted)] w-8">#</th>
                      <th className="text-left pb-2 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Category</th>
                      <th className="text-right pb-2 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Amount</th>
                      <th className="text-right pb-2 pr-3 text-xs font-medium text-[var(--color-text-muted)]">% of Total</th>
                      {data.hasPriorMonth && (
                        <th className="text-right pb-2 text-xs font-medium text-[var(--color-text-muted)]">vs Prior Period</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCategories.map((cat, i) => (
                      <tr key={cat.name} className="border-b border-[var(--color-border)]/50 last:border-0">
                        <td className="py-2.5 pr-3 text-xs text-[var(--color-text-muted)] font-mono">{i + 1}</td>
                        <td className="py-2.5 pr-3">
                          <p className="text-[var(--color-text-primary)]">{cat.name}</p>
                          <div className="mt-1 h-1 rounded-full bg-[var(--color-bg-tertiary)] w-32">
                            <div
                              className="h-1 rounded-full bg-[var(--color-accent)]"
                              style={{ width: `${Math.min(cat.pctOfTotal, 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-[var(--color-text-primary)]">
                          {fmt(cat.amount)}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-[var(--color-text-secondary)]">
                          {cat.pctOfTotal.toFixed(1)}%
                        </td>
                        {data.hasPriorMonth && (
                          <td className="py-2.5 text-right">
                            {cat.changePct != null ? (
                              <span
                                className={`text-xs font-medium ${
                                  cat.changePct > 5
                                    ? "text-[var(--color-danger)]"
                                    : cat.changePct < -5
                                    ? "text-[var(--color-success)]"
                                    : "text-[var(--color-text-muted)]"
                                }`}
                              >
                                {cat.changePct > 0 ? "▲" : cat.changePct < 0 ? "▼" : "—"}{" "}
                                {Math.abs(cat.changePct).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--color-text-muted)]">New</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="sm:hidden space-y-0">
                {data.topCategories.map((cat, i) => (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)]/50 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-[var(--color-text-muted)] w-5 shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--color-text-primary)] truncate">{cat.name}</p>
                        <div className="mt-1 h-1 rounded-full bg-[var(--color-bg-tertiary)] w-24">
                          <div
                            className="h-1 rounded-full bg-[var(--color-accent)]"
                            style={{ width: `${Math.min(cat.pctOfTotal, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{cat.pctOfTotal.toFixed(1)}% of total</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{fmt(cat.amount)}</p>
                      {data.hasPriorMonth && cat.changePct != null && (
                        <p
                          className={`text-xs ${
                            cat.changePct > 5
                              ? "text-[var(--color-danger)]"
                              : cat.changePct < -5
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {cat.changePct > 0 ? "▲" : "▼"} {Math.abs(cat.changePct).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MoM Comparison Chart ───────────────────────────── */}
          {data.hasPriorMonth && data.topCategories.some((c) => c.prevAmount != null) && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[var(--color-border)]">
                <BarChart2 className="h-4 w-4 text-[var(--color-accent)]" />
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Period-over-Period Comparison
                </span>
              </div>
              <MoMChart categories={data.topCategories} />
            </div>
          )}

          
        </>
      )}
    </div>
  );
}
