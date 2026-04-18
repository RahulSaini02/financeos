"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { HelpModal } from "@/components/ui/help-modal";
import { formatCurrency } from "@/lib/utils";
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
            name === "thisMonth" ? "This Month" : "Last Month",
          ]}
        />
        <Legend
          formatter={(v) => (v === "thisMonth" ? "This Month" : "Last Month")}
          wrapperStyle={{ fontSize: 11, color: "#c0c0d0", paddingTop: 8 }}
        />
        <Bar dataKey="lastMonth" fill="#374151" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="thisMonth" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AiReviewClient({ initialData }: { initialData: ReviewData | null }) {
  const [data, setData] = useState<ReviewData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(force ? "/api/ai-review?force=true" : "/api/ai-review");
      if (!res.ok) throw new Error("Failed to load review");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData || !initialData.analysis) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="AI Financial Review"
        subtitle={loading && !data ? "Loading…" : (data?.label ?? "Last 15 Days")}
        tooltip={
          <HelpModal
            title="AI Financial Review"
            description="A 15-day review cycle AI-powered analysis of your recent spending. Cached per period for instant access."
            sections={[
              {
                heading: "How it works",
                items: [
                  "Each month is split into two 15-day windows: day 1–15 and day 16–end",
                  "Auto-generates a TLDR review for the current 15-day period",
                  "Compares current period vs the prior 15-day window for trend context",
                  "Hit Refresh to regenerate with the latest data at any time",
                ],
              },
            ]}
          />
        }
      >
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </PageHeader>

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
          <span>Regenerating analysis with latest data…</span>
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
                        <th className="text-right pb-2 text-xs font-medium text-[var(--color-text-muted)]">vs Prior Month</th>
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
                  Month-over-Month Comparison
                </span>
              </div>
              <MoMChart categories={data.topCategories} />
            </div>
          )}

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
        </>
      )}
    </div>
  );
}
