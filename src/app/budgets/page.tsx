"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Pencil,
  ExternalLink,
  PieChart,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import type { Budget, Category } from "@/lib/types";

interface BudgetWithActual extends Budget {
  category: Category;
  spent: number;
}

interface BudgetCategory {
  id: string;
  category_id: string;
  name: string;
  icon: string;
  amount_usd: number;
  spent: number;
}

function getProgressColor(pct: number): string {
  if (pct >= 100) return "bg-[var(--color-danger)]";
  if (pct >= 80) return "bg-[var(--color-warning)]";
  return "bg-[var(--color-success)]";
}

function getRemainingColor(remaining: number): string {
  if (remaining < 0) return "text-[var(--color-danger)]";
  return "text-[var(--color-success)]";
}

function BudgetModal({
  category,
  existingAmount,
  onClose,
  onSave,
}: {
  category: { id: string; name: string; icon: string } | null;
  existingAmount?: number;
  onClose: () => void;
  onSave: (id: string, amount: number) => void;
}) {
  const [amount, setAmount] = useState<string>(
    existingAmount != null ? existingAmount.toString() : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (category && amount) {
      onSave(category.id, parseFloat(amount));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {category ? `Edit Budget: ${category.icon} ${category.name}` : "Add Budget"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <X className="h-5 w-5 text-[var(--color-text-muted)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              Monthly Budget Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] py-2 pl-7 pr-4 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Budget
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed

  const [budgets, setBudgets] = useState<BudgetWithActual[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; icon: string } | null>(null);

  const monthParam = `${year}-${String(month).padStart(2, "0")}-01`;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Month range for transaction filtering
      const monthStart = monthParam;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonthNum = month === 12 ? 1 : month + 1;
      const nextMonthStart = `${nextYear}-${String(nextMonthNum).padStart(2, "0")}-01`;

      // Fetch budgets with joined categories
      const { data: budgetData, error: budgetError } = await supabase
        .from("budgets")
        .select("*, category:categories(*)")
        .eq("user_id", user.id)
        .eq("month", monthParam);

      if (budgetError) throw new Error(budgetError.message);

      // Fetch all user categories for the "add budget" dropdown
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (categoryError) throw new Error(categoryError.message);

      // Fetch actual debit transactions for this month
      const { data: txnData, error: txnError } = await supabase
        .from("transactions")
        .select("category_id, amount_usd")
        .eq("user_id", user.id)
        .eq("cr_dr", "debit")
        .gte("date", monthStart)
        .lt("date", nextMonthStart);

      if (txnError) throw new Error(txnError.message);

      // Aggregate actual spend per category
      const actualsByCategory: Record<string, number> = {};
      for (const txn of txnData ?? []) {
        if (txn.category_id) {
          actualsByCategory[txn.category_id] =
            (actualsByCategory[txn.category_id] ?? 0) + (txn.amount_usd ?? 0);
        }
      }

      // Merge budgets with actuals
      const merged: BudgetWithActual[] = (budgetData ?? []).map((b) => ({
        ...b,
        spent: actualsByCategory[b.category_id] ?? 0,
      }));

      setBudgets(merged);
      setCategories(categoryData ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, monthParam]);

  const handleSaveBudget = async (categoryId: string, amount: number) => {
    if (!user) return;
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("budgets").upsert(
      {
        user_id: user.id,
        category_id: categoryId,
        month: monthParam,
        amount_usd: amount,
      },
      { onConflict: "user_id,category_id,month" }
    );
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setModalOpen(false);
    setEditingCategory(null);
    await fetchData();
  };

  const handleDeleteBudget = async (id: string) => {
    if (!user) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("budgets")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await fetchData();
  };

  // Categories that already have a budget this month
  const categoriesWithBudgets: BudgetCategory[] = useMemo(() => {
    return budgets
      .filter((b) => b.category != null)
      .map((b) => ({
        id: b.id,
        category_id: b.category_id,
        name: b.category.name,
        icon: b.category.icon ?? "📦",
        amount_usd: b.amount_usd,
        spent: b.spent,
      }))
      .sort((a, b) => {
        const aPct = (a.spent / a.amount_usd) * 100;
        const bPct = (b.spent / b.amount_usd) * 100;
        return bPct - aPct;
      });
  }, [budgets]);

  // Categories without a budget set for this month
  const categoriesWithoutBudgets = useMemo(() => {
    const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id));
    return categories.filter((c) => !budgetedCategoryIds.has(c.id));
  }, [budgets, categories]);

  // Find the existing budget amount for a category (for pre-filling the modal)
  const getExistingAmount = (categoryId: string): number | undefined => {
    const budget = budgets.find((b) => b.category_id === categoryId);
    return budget?.amount_usd;
  };

  const totalBudgeted = categoriesWithBudgets.reduce((sum, b) => sum + b.amount_usd, 0);
  const totalSpent = categoriesWithBudgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overBudgetCount = categoriesWithBudgets.filter(
    (b) => b.spent > b.amount_usd
  ).length;
  const overallPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const openModal = (category: { id: string; name: string; icon: string } | null = null) => {
    setEditingCategory(category);
    setModalOpen(true);
  };

  function drillDown(cat: BudgetCategory) {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthNum = month === 12 ? 1 : month + 1;
    const startDate = monthParam;
    const endDate = `${nextYear}-${String(nextMonthNum).padStart(2, "0")}-01`;
    router.push(
      `/transactions?categoryId=${cat.category_id}&startDate=${startDate}&endDate=${endDate}`
    );
  }

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
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Track and manage your monthly spending limits
          </p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-medium min-w-[140px] text-center">
          {monthLabel}
        </span>
        <Button variant="ghost" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Overall Utilization Bar */}
      <Card>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">Overall Budget Utilization</span>
            <span className="font-medium">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudgeted)}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getProgressColor(overallPct)}`}
              style={{ width: `${Math.min(overallPct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>{overallPct.toFixed(1)}% used</span>
            <span>{totalRemaining >= 0 ? `${formatCurrency(totalRemaining)} remaining` : `${formatCurrency(Math.abs(totalRemaining))} over`}</span>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Total Budgeted</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {formatCurrency(totalBudgeted)}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Total Spent</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {formatCurrency(totalSpent)}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Total Remaining</CardTitle>
          <CardValue className={`mt-2 ${getRemainingColor(totalRemaining)}`}>
            {totalRemaining >= 0 ? formatCurrency(totalRemaining) : `-${formatCurrency(Math.abs(totalRemaining))}`}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Over Budget</CardTitle>
          <CardValue className={`mt-2 ${overBudgetCount > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]"}`}>
            {overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"}
          </CardValue>
        </Card>
      </div>

      {/* Budget Categories */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Categories</h2>

        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] mb-4">
              <PieChart className="h-6 w-6 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">No categories yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xs">
              Create categories first, then set monthly budgets for each one.
            </p>
            <a
              href="/categories"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Go to Categories
            </a>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categoriesWithBudgets.map((cat) => {
            const pct = (cat.spent / cat.amount_usd) * 100;
            const remaining = cat.amount_usd - cat.spent;

            return (
              <Card
                key={cat.id}
                className="hover:border-[var(--color-accent)] transition-colors cursor-pointer"
                onClick={() => drillDown(cat)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="font-medium text-sm">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openModal({ id: cat.category_id, name: cat.name, icon: cat.icon })}
                      className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                      title="Edit budget"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <ExternalLink className="h-3 w-3 text-[var(--color-text-muted)]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-secondary)]">
                      {formatCurrency(cat.spent)} of {formatCurrency(cat.amount_usd)}
                    </span>
                    <span className={`font-medium ${getRemainingColor(remaining)}`}>
                      {remaining >= 0
                        ? `${formatCurrency(remaining)} left`
                        : `${formatCurrency(Math.abs(remaining))} over`}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Add Budget Cards for categories without a budget */}
          {categoriesWithoutBudgets.map((cat) => (
            <Card
              key={cat.id}
              className="hover:border-[var(--color-accent)] transition-colors cursor-pointer border-dashed"
              onClick={() => openModal({ id: cat.id, name: cat.name, icon: cat.icon ?? "📦" })}
            >
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] mb-3">
                  <Plus className="h-5 w-5 text-[var(--color-text-muted)]" />
                </div>
                <span className="text-xl mb-1">{cat.icon ?? "📦"}</span>
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {cat.name}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] mt-1">
                  Set budget
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Budget Modal */}
      {modalOpen && (
        <BudgetModal
          category={editingCategory}
          existingAmount={editingCategory ? getExistingAmount(editingCategory.id) : undefined}
          onClose={() => {
            setModalOpen(false);
            setEditingCategory(null);
          }}
          onSave={handleSaveBudget}
        />
      )}
    </div>
  );
}
