"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, ChevronUp } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface CategoryDrillDownProps {
  categoryName: string;
  categoryId: string;
  color: string;
  month: string; // "YYYY-MM-DD" (first day of viewed month)
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
}

interface TxnRow {
  id: string;
  description: string;
  date: string;
  final_amount: number;
  cr_dr: string;
}

function formatTxnDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(y, m - 1, d));
}

export function CategoryDrillDown({
  categoryName,
  categoryId,
  color,
  month,
  expanded,
  onExpand,
  onClose,
}: CategoryDrillDownProps) {
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).toISOString().split("T")[0];

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, mon - 1, 1));

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          categoryId,
          startDate: month,
          endDate: lastDay,
          limit: "20",
        });
        const res = await fetch(`/api/transactions?${params}`);
        const json = (await res.json()) as { data?: TxnRow[] };
        const txns: TxnRow[] = (json.data ?? []).map((t) => ({
          id: t.id,
          description: t.description,
          date: t.date,
          final_amount: t.final_amount,
          cr_dr: t.cr_dr,
        }));
        setTransactions(txns);
        setTotal(
          txns
            .filter((t) => t.cr_dr === "debit")
            .reduce((s, t) => s + Math.abs(t.final_amount ?? 0), 0)
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [categoryId, month, lastDay]);

  const viewAllHref = `/transactions?categoryId=${categoryId}&startDate=${month}&endDate=${lastDay}`;

  return (
    <>
      {/* Backdrop — mobile: only when expanded; desktop: always */}
      <div
        className={`fixed inset-0 bg-black/40 z-30 ${expanded ? "block" : "hidden lg:block"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Peek bar — mobile only, when panel is collapsed */}
      {!expanded && (
        <div className="lg:hidden fixed inset-x-0 bottom-[4rem] z-50 flex items-center gap-3 px-4 h-12 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] shadow-lg">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate">
            {categoryName}
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
            {loading ? "…" : formatCurrency(total)}
          </span>
          <button
            onClick={onExpand}
            className="flex items-center gap-0.5 text-xs font-medium text-[var(--color-accent)] px-2 py-1 rounded-md hover:bg-[var(--color-accent)]/10 transition-colors"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            View
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Full panel — hidden on mobile until expanded; always shown on desktop as slide-over */}
      <div
        className={`fixed z-40 bg-[var(--color-bg-secondary)] shadow-2xl flex-col
          inset-x-0 bottom-0 max-h-[72vh] rounded-t-2xl border-t border-[var(--color-border)]
          ${expanded ? "flex" : "hidden lg:flex"}
          lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-0 lg:h-full lg:w-96 lg:max-h-none lg:rounded-none lg:border-t-0 lg:border-l`}
      >
        {/* Drag handle — mobile only */}
        <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mt-3 mb-1 lg:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {categoryName}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {monthLabel}&nbsp;&middot;&nbsp;
                {loading ? "…" : formatCurrency(total)} total
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 animate-pulse">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="h-3.5 w-2/3 rounded bg-[var(--color-bg-tertiary)]" />
                    <div className="h-2.5 w-1/3 rounded bg-[var(--color-bg-tertiary)]" />
                  </div>
                  <div className="h-3.5 w-16 rounded bg-[var(--color-bg-tertiary)] ml-4" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-10">
              No transactions in this category for the selected month.
            </p>
          ) : (
            <div className="space-y-0.5">
              {transactions.map((txn) => {
                const isCredit = txn.cr_dr === "credit";
                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {txn.description}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatTxnDate(txn.date)}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-semibold shrink-0 ml-3 ${
                        isCredit ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {formatCurrency(Math.abs(txn.final_amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-4 border-t border-[var(--color-border)]">
          <Link
            href={viewAllHref}
            className="flex items-center justify-center gap-1.5 w-full rounded-lg px-4 py-2.5 text-sm font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
          >
            View all transactions
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}
