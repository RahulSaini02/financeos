"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const PAGES = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Transactions", href: "/transactions" },
  { label: "Accounts", href: "/accounts" },
  { label: "Budgets", href: "/budgets" },
  { label: "Loans", href: "/loans" },
  { label: "Investments", href: "/investments" },
  { label: "Savings Goals", href: "/savings-goals" },
  { label: "Settings", href: "/settings" },
];

interface TransactionResult {
  id: string;
  description: string;
  final_amount: number;
  cr_dr: "credit" | "debit";
  date: string;
  account_name: string;
  category_name: string;
}

interface AccountResult {
  id: string;
  name: string;
  type: string;
  current_balance: number;
}

interface CategoryResult {
  id: string;
  name: string;
  icon: string;
}

interface SearchResults {
  transactions: TransactionResult[];
  accounts: AccountResult[];
  categories: CategoryResult[];
}

type FlatItem =
  | { kind: "transaction"; data: TransactionResult }
  | { kind: "account"; data: AccountResult }
  | { kind: "category"; data: CategoryResult }
  | { kind: "page"; data: { label: string; href: string } };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (!((e.metaKey || e.ctrlKey) && e.key === "k")) return;
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !open) return;
      e.preventDefault();
      if (open) {
        closeModal();
      } else {
        setOpen(true);
      }
    }
    function handleOpenEvent() { setOpen(true); }
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("open-global-search", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("open-global-search", handleOpenEvent);
    };
  }, [open, closeModal]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = (await res.json()) as SearchResults;
          setResults(data);
          setActiveIndex(0);
        }
      } catch {
        // network errors are silently ignored
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = useCallback(
    (item: FlatItem) => {
      if (item.kind === "transaction") {
        router.push(`/transactions?search=${encodeURIComponent(item.data.description)}`);
      } else if (item.kind === "account") {
        router.push("/accounts");
      } else if (item.kind === "category") {
        router.push("/categories");
      } else {
        router.push(item.data.href);
      }
      closeModal();
    },
    [router, closeModal],
  );

  const flatItems: FlatItem[] = [];
  if (results) {
    results.transactions.forEach((t) => flatItems.push({ kind: "transaction", data: t }));
    results.accounts.forEach((a) => flatItems.push({ kind: "account", data: a }));
    results.categories.forEach((c) => flatItems.push({ kind: "category", data: c }));
  }
  PAGES.forEach((p) => flatItems.push({ kind: "page", data: p }));

  function handleModalKeydown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      closeModal();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(flatItems.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) handleSelect(item);
    }
  }

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col sm:items-start sm:justify-center sm:p-4 sm:pt-[15vh]">
      <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
      <div
        className="relative z-10 w-full flex flex-col flex-1 sm:flex-none sm:max-w-lg sm:rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl overflow-hidden"
        onKeyDown={handleModalKeydown}
      >
        <div className="flex items-center border-b border-[var(--color-border)] px-4">
          <Search className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions, accounts…"
            className="flex-1 bg-transparent py-3.5 pl-3 pr-2 text-base outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <div className="flex items-center gap-1 pr-1">
            {loading && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-text-muted)]" />
            )}
            {!loading && query && (
              <button
                onClick={() => setQuery("")}
                className="rounded p-0.5 hover:bg-[var(--color-bg-tertiary)]"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
              </button>
            )}
          </div>
          <button
            className="sm:hidden flex items-center gap-1 px-3 py-3.5 text-sm text-[var(--color-text-secondary)]"
            onClick={closeModal}
          >
            Cancel
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {results && (
            <>
              {results.transactions.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Transactions ({results.transactions.length})
                  </p>
                  {results.transactions.map((t) => {
                    const idx = globalIdx++;
                    const active = activeIndex === idx;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSelect({ kind: "transaction", data: t })}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${active ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-tertiary)]"}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.description}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {t.account_name}
                            {t.account_name && t.date ? " · " : ""}
                            {t.date}
                          </p>
                        </div>
                        <span
                          className={`ml-4 shrink-0 text-sm font-medium tabular-nums ${t.cr_dr === "debit" ? "text-red-400" : "text-emerald-400"}`}
                        >
                          {t.cr_dr === "debit" ? "-" : "+"}
                          {formatCurrency(t.final_amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {results.accounts.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Accounts ({results.accounts.length})
                  </p>
                  {results.accounts.map((a) => {
                    const idx = globalIdx++;
                    const active = activeIndex === idx;
                    return (
                      <button
                        key={a.id}
                        onClick={() => handleSelect({ kind: "account", data: a })}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${active ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-tertiary)]"}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)] capitalize">{a.type.replace(/_/g, " ")}</p>
                        </div>
                        <span className="ml-4 shrink-0 text-sm font-medium tabular-nums">
                          {formatCurrency(a.current_balance)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {results.categories.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Categories ({results.categories.length})
                  </p>
                  {results.categories.map((c) => {
                    const idx = globalIdx++;
                    const active = activeIndex === idx;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSelect({ kind: "category", data: c })}
                        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${active ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-tertiary)]"}`}
                      >
                        {c.icon && <span className="shrink-0 text-base">{c.icon}</span>}
                        <span className="truncate text-sm font-medium">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {results.transactions.length === 0 &&
                results.accounts.length === 0 &&
                results.categories.length === 0 && (
                  <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                )}
            </>
          )}

          <div>
            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Pages
            </p>
            {PAGES.map((p) => {
              const idx = globalIdx++;
              const active = activeIndex === idx;
              return (
                <button
                  key={p.href}
                  onClick={() => handleSelect({ kind: "page", data: p })}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${active ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-tertiary)]"}`}
                >
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{p.href}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-2 flex items-center gap-3">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            <kbd className="inline-flex h-4 items-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1 font-mono text-[10px]">↑↓</kbd>
            {" "}navigate
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            <kbd className="inline-flex h-4 items-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1 font-mono text-[10px]">↵</kbd>
            {" "}select
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            <kbd className="inline-flex h-4 items-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1 font-mono text-[10px]">Esc</kbd>
            {" "}close
          </span>
        </div>
      </div>
    </div>
  );
}
