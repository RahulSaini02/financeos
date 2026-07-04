"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency-context";

interface BudgetItem {
  id: string;
  categoryName: string;
  limit: number;
  spent: number;
  pct: number;
}

interface BudgetProgressBarsProps {
  budgets: BudgetItem[];
  selectedMonth: string; // for display
  isCurrentMonth: boolean;
}

export function BudgetProgressBars({ budgets, selectedMonth, isCurrentMonth }: BudgetProgressBarsProps) {
  const { fmt } = useCurrency();
  if (budgets.length === 0) return null;

  const [year, month] = selectedMonth.split("-");
  const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Budget Progress</CardTitle>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{monthLabel}</p>
        </div>
        <Link href="/budgets">
          <Button variant="ghost" size="sm">
            Manage <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-1">
        {budgets.map((b) => {
          const isOver = b.pct >= 100;
          const isWarning = b.pct >= 80 && b.pct < 100;
          const barColor = isOver
            ? "bg-[var(--color-danger)]"
            : isWarning
            ? "bg-[var(--color-warning)]"
            : "bg-[var(--color-success)]";
          const textColor = isOver
            ? "text-[var(--color-danger)]"
            : isWarning
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-success)]";

          return (
            <div key={b.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">{b.categoryName}</span>
                <span className={`text-xs font-semibold shrink-0 ${textColor}`}>{b.pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(b.pct, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-text-muted)]">{fmt(b.spent)}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{fmt(b.limit)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {budgets.some((b) => b.pct >= 100) && isCurrentMonth && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-danger)]">
            {budgets.filter((b) => b.pct >= 100).length} budget{budgets.filter((b) => b.pct >= 100).length !== 1 ? "s" : ""} exceeded this month
          </p>
        </div>
      )}
    </Card>
  );
}
