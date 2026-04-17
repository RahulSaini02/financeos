"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthNav } from "@/components/ui/month-nav";
import {
  X,
  Loader2,
  AlertTriangle,
  Pencil,
  PieChart,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Category } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryRow {
  category: Category;
  budget: number;
  isOverride: boolean;
  budgetRowId: string | null;
  spent: number;
  pct: number;
}

type StatusGroup = "over" | "at_risk" | "on_track" | "unbudgeted";

function groupStatus(row: CategoryRow): StatusGroup {
  if (row.budget <= 0) return "unbudgeted";
  if (row.pct >= 100) return "over";
  if (row.pct >= 80) return "at_risk";
  return "on_track";
}

const GROUP_META: Record<StatusGroup, { label: string; color: string; barColor: string; icon: React.ReactNode }> = {
  over:       { label: "Over Budget", color: "text-[var(--color-danger)]",   barColor: "bg-[var(--color-danger)]",   icon: <TrendingUp  className="h-4 w-4" /> },
  at_risk:    { label: "At Risk",     color: "text-[var(--color-warning)]",  barColor: "bg-[var(--color-warning)]",  icon: <Minus       className="h-4 w-4" /> },
  on_track:   { label: "On Track",    color: "text-[var(--color-success)]",  barColor: "bg-[var(--color-success)]",  icon: <TrendingDown className="h-4 w-4" /> },
  unbudgeted: { label: "Unbudgeted",  color: "text-[var(--color-text-muted)]", barColor: "bg-[var(--color-accent)]", icon: <PieChart    className="h-4 w-4" /> },
};

// ── Override Modal ────────────────────────────────────────────────────────────

function OverrideModal({
  category, currentBudget, isOverride, onClose, onSave, onClear, saving,
}: {
  category: Category;
  currentBudget: number;
  isOverride: boolean;
  onClose: () => void;
  onSave: (amount: number) => void;
  onClear: () => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState(currentBudget > 0 ? currentBudget.toFixed(2) : "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold">{category.icon} {category.name}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {isOverride ? "This month's override" : `Default: ${formatCurrency(category.monthly_budget ?? 0)}/mo`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-bg-tertiary)] transition-colors">
            <X className="h-5 w-5 text-[var(--color-text-muted)]" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Monthly Budget for this Month</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
              <input
                type="number" step="0.01" min="0" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={category.monthly_budget?.toFixed(2) ?? "0.00"}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-2 pl-7 pr-4 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                autoFocus
              />
            </div>
            {isOverride && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                Default from category: {formatCurrency(category.monthly_budget ?? 0)}/mo. Clear override to revert.
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            {isOverride && (
              <Button variant="secondary" onClick={onClear} disabled={saving} className="flex-1 text-[var(--color-danger)]">Clear Override</Button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={saving} className={isOverride ? "" : "flex-1"}>Cancel</Button>
            <Button onClick={() => onSave(parseFloat(amount) || 0)} disabled={saving || !amount} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {isOverride ? "Update Override" : "Set Override"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category Card ─────────────────────────────────────────────────────────────

function CategoryCard({ row, onEdit, onDrillDown }: {
  row: CategoryRow;
  onEdit: (row: CategoryRow) => void;
  onDrillDown: (row: CategoryRow) => void;
}) {
  const status = groupStatus(row);
  const meta = GROUP_META[status];
  const remaining = row.budget - row.spent;
  const isUnbudgeted = status === "unbudgeted";

  return (
    <div
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 hover:border-[var(--color-accent)]/50 transition-colors cursor-pointer"
      onClick={() => onDrillDown(row)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{row.category.icon ?? "📦"}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{row.category.name}</p>
            {row.isOverride && <span className="text-[10px] text-[var(--color-accent)] font-medium">month override</span>}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(row); }}
          className="flex-shrink-0 ml-2 flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          title="Edit budget"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      {!isUnbudgeted && (
        <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden mb-3">
          <div className={`h-full rounded-full transition-all ${meta.barColor}`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
        </div>
      )}
      <div className="space-y-1">
        {isUnbudgeted ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Spent (no budget)</span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(row.spent)}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>{formatCurrency(row.spent)} spent</span>
              <span>{formatCurrency(row.budget)} budget</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${meta.color}`}>{row.pct.toFixed(0)}% used</span>
              <span className={`text-sm font-semibold ${remaining >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function buildRows(
  categories: Category[],
  budgets: Array<{ id: string; category_id: string; amount_usd: number }>,
  transactions: Array<{ category_id: string | null; amount_usd: number | null }>
): CategoryRow[] {
  const spendMap: Record<string, number> = {};
  for (const t of transactions) {
    if (t.category_id) spendMap[t.category_id] = (spendMap[t.category_id] ?? 0) + Math.abs(t.amount_usd ?? 0);
  }
  const overrideMap: Record<string, { id: string; amount_usd: number }> = {};
  for (const b of budgets) overrideMap[b.category_id] = { id: b.id, amount_usd: b.amount_usd };

  const rows: CategoryRow[] = [];
  for (const cat of categories) {
    const override = overrideMap[cat.id];
    const defaultBudget = cat.monthly_budget ?? 0;
    const budget = override ? override.amount_usd : defaultBudget;
    const spent = spendMap[cat.id] ?? 0;
    if (budget === 0 && spent === 0) continue;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    rows.push({
      category: cat,
      budget,
      isOverride: !!override,
      budgetRowId: override?.id ?? null,
      spent,
      pct,
    });
  }
  return rows;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BudgetsClient({
  initialCategories,
  initialBudgets,
  initialTransactions,
  initialYear,
  initialMonth,
  userId,
}: {
  initialCategories: Category[];
  initialBudgets: Array<{ id: string; category_id: string; amount_usd: number; month: string }>;
  initialTransactions: Array<{ category_id: string | null; amount_usd: number | null }>;
  initialYear: number;
  initialMonth: number;
  userId: string;
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const [rows, setRows] = useState<CategoryRow[]>(() =>
    buildRows(initialCategories, initialBudgets, initialTransactions)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [saving, setSaving] = useState(false);

  const pad = (n: number) => String(n).padStart(2, "0");
  const monthParam = `${year}-${pad(month)}-01`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Re-fetch when month changes (skip first render — server already provided initial data)
  const isInitialMonth = year === initialYear && month === initialMonth;

  useEffect(() => {
    if (isInitialMonth) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonthNum = month === 12 ? 1 : month + 1;
        const nextMonthStart = `${nextYear}-${pad(nextMonthNum)}-01`;

        const [catRes, budgetRes, txnRes] = await Promise.all([
          supabase.from("categories").select("*").eq("user_id", userId).in("type", ["expense"]).order("name"),
          supabase.from("budgets").select("*").eq("user_id", userId).eq("month", monthParam),
          supabase.from("transactions").select("category_id, amount_usd").eq("user_id", userId).eq("cr_dr", "debit").eq("is_internal_transfer", false).gte("date", monthParam).lt("date", nextMonthStart),
        ]);

        if (catRes.error) throw new Error(catRes.error.message);
        setRows(buildRows(catRes.data ?? [], budgetRes.data ?? [], txnRes.data ?? []));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load budgets");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, userId]);

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonthNum = month === 12 ? 1 : month + 1;
      const nextMonthStart = `${nextYear}-${pad(nextMonthNum)}-01`;

      const [catRes, budgetRes, txnRes] = await Promise.all([
        supabase.from("categories").select("*").eq("user_id", userId).in("type", ["expense"]).order("name"),
        supabase.from("budgets").select("*").eq("user_id", userId).eq("month", monthParam),
        supabase.from("transactions").select("category_id, amount_usd").eq("user_id", userId).eq("cr_dr", "debit").eq("is_internal_transfer", false).gte("date", monthParam).lt("date", nextMonthStart),
      ]);

      if (catRes.error) throw new Error(catRes.error.message);
      setRows(buildRows(catRes.data ?? [], budgetRes.data ?? [], txnRes.data ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (amount: number) => {
    if (!editing) return;
    setSaving(true);
    const supabase = createClient();

    const { error: upsertErr } = await supabase.from("budgets").upsert(
      { user_id: userId, category_id: editing.category.id, month: monthParam, amount_usd: amount },
      { onConflict: "user_id,category_id,month" }
    );
    if (upsertErr) { setSaving(false); setError(upsertErr.message); return; }

    await supabase.from("categories").update({ monthly_budget: amount }).eq("id", editing.category.id).eq("user_id", userId);

    setSaving(false);
    setEditing(null);
    await refetch();
  };

  const handleClearOverride = async () => {
    if (!editing?.budgetRowId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("budgets").delete().eq("id", editing.budgetRowId);
    setSaving(false);
    setEditing(null);
    await refetch();
  };

  const handleDrillDown = (row: CategoryRow) => {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthNum = month === 12 ? 1 : month + 1;
    const endDate = `${nextYear}-${pad(nextMonthNum)}-01`;
    router.push(`/transactions?categoryId=${row.category.id}&startDate=${monthParam}&endDate=${endDate}`);
  };

  const budgetedRows = useMemo(() => rows.filter(r => r.budget > 0), [rows]);
  const totalBudgeted = budgetedRows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overallPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const grouped = useMemo(() => {
    const g: Record<StatusGroup, CategoryRow[]> = { over: [], at_risk: [], on_track: [], unbudgeted: [] };
    for (const r of rows) g[groupStatus(r)].push(r);
    for (const key of Object.keys(g) as StatusGroup[]) g[key].sort((a, b) => b.pct - a.pct);
    return g;
  }, [rows]);

  const statusOrder: StatusGroup[] = ["over", "at_risk", "on_track", "unbudgeted"];

  if (loading) return <GridPageSkeleton cards={8} />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Budgets"
        subtitle="Actual spend vs monthly limits · budgets auto-loaded from categories"
        tooltip={
          <HelpModal
            title="Budgets"
            description="Set monthly spending limits per category and track how you are performing against them in real time."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Click a category card's edit icon to set a monthly limit",
                  "Watch the progress bars — green means on track, red means over budget",
                  "Use the month navigator to review past budget performance",
                  "Budgets auto-reset each month; adjust amounts any time",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Edit — increase or decrease a budget mid-month",
                  "Clear Override — revert to the category's default monthly budget",
                  "Month nav — switch between months to compare performance",
                ],
              },
            ]}
          />
        }
      >
        <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </PageHeader>

      {/* Summary strip */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 space-y-4">
        <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
          <div className="pr-6">
            <p className="text-xs text-[var(--color-text-muted)]">Total Budgeted</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{formatCurrency(totalBudgeted)}</p>
          </div>
          <div className="px-6">
            <p className="text-xs text-[var(--color-text-muted)]">Spent So Far</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="pl-6">
            <p className="text-xs text-[var(--color-text-muted)]">{totalRemaining >= 0 ? "Remaining" : "Over by"}</p>
            <p className={`text-xl font-bold mt-0.5 ${totalRemaining >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {formatCurrency(Math.abs(totalRemaining))}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${overallPct >= 100 ? "bg-[var(--color-danger)]" : overallPct >= 80 ? "bg-[var(--color-warning)]" : "bg-[var(--color-success)]"}`}
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>{overallPct.toFixed(1)}% of total budget used</span>
            <span>
              {grouped.over.length > 0 && <span className="text-[var(--color-danger)]">{grouped.over.length} over-budget</span>}
              {grouped.at_risk.length > 0 && <span className="text-[var(--color-warning)] ml-2">{grouped.at_risk.length} at risk</span>}
            </span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<PieChart className="h-8 w-8" />}
          title="No spending data this month"
          description="Add transactions or set monthly budgets in your categories to see tracking here."
          action={{ label: "Go to Categories →", href: "/categories" }}
        />
      ) : (
        <div className="space-y-8">
          {statusOrder.map((status) => {
            const group = grouped[status];
            if (group.length === 0) return null;
            const meta = GROUP_META[status];
            return (
              <section key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={meta.color}>{meta.icon}</span>
                  <h2 className={`text-sm font-semibold ${meta.color}`}>{meta.label}</h2>
                  <span className="text-xs text-[var(--color-text-muted)]">· {group.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.map((row) => (
                    <CategoryCard key={row.category.id} row={row} onEdit={setEditing} onDrillDown={handleDrillDown} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <OverrideModal
          category={editing.category}
          currentBudget={editing.budget}
          isOverride={editing.isOverride}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onClear={handleClearOverride}
          saving={saving}
        />
      )}
    </div>
  );
}
