"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, getUserTimezone } from "@/lib/utils";
import type { Transaction, Account, Category, Loan, TransactionType } from "@/lib/types";

interface TransactionModalProps {
  txn: Transaction | null;
  accounts: Account[];
  categories: Category[];
  loans: Loan[];
  onSave: (t: Partial<Transaction> & { loan_id?: string | null; target_account_id?: string | null }) => void;
  onClose: () => void;
}

export function TransactionModal({
  txn,
  accounts,
  categories: categoriesProp,
  loans,
  onSave,
  onClose,
}: TransactionModalProps) {
  // Always fetch fresh categories from the API so newly added ones appear immediately
  const [categories, setCategories] = useState<Category[]>(categoriesProp);
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.data?.length) setCategories(json.data); })
      .catch(() => {}); // fall back to prop if fetch fails
  }, []);
  const isTransfer = (txn as Transaction & { is_internal_transfer?: boolean })?.is_internal_transfer;
  const [mode, setMode] = useState<"expense" | "income" | "transfer">(
    isTransfer ? "transfer" : (txn?.cr_dr === "credit" ? "income" : "expense")
  );
  const [description, setDescription] = useState(txn?.description ?? "");
  const [amount, setAmount] = useState(txn ? Math.abs(txn.amount_usd).toString() : "");
  const [, setCrDr] = useState<"credit" | "debit">(txn?.cr_dr ?? "debit");
  const [accountId, setAccountId] = useState(txn?.account_id ?? accounts[0]?.id ?? "");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [categoryId, setCategoryId] = useState(txn?.category_id ?? "");
  const [date, setDate] = useState(txn?.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: getUserTimezone() }).format(new Date()));
  const [notes, setNotes] = useState(txn?.notes ?? "");
  const [loanId, setLoanId] = useState<string>(
    (txn as Transaction & { loan_id?: string })?.loan_id ?? ""
  );

  // AI auto-categorization state
  const [isCategorizingAI, setIsCategorizingAI] = useState(false);
  const [isAISuggested, setIsAISuggested] = useState(false);
  // Track whether the user has manually touched the category field
  const categoryManuallySet = useRef(false);
  // Refs for values read inside the debounce effect to avoid stale closures
  const modeRef = useRef(mode);
  const categoryIdRef = useRef(categoryId);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { categoryIdRef.current = categoryId; }, [categoryId]);

  // Reset the manual-set guard whenever the modal switches to a new transaction (txn → null = new add)
  useEffect(() => {
    categoryManuallySet.current = false;
    setIsAISuggested(false);
  }, [txn]);

  // Debounced auto-categorization — triggers when description changes
  useEffect(() => {
    // Skip for transfers or if user manually picked a category this session
    if (modeRef.current === "transfer" || categoryManuallySet.current) return;
    // For edits with an existing category, don't auto-overwrite
    if (txn && categoryIdRef.current) return;
    if (!description || description.trim().length < 2) return;

    const timer = setTimeout(async () => {
      if (modeRef.current === "transfer" || categoryManuallySet.current) return;
      // For edits with an existing category, don't auto-overwrite
      if (txn && categoryIdRef.current) return;
      setIsCategorizingAI(true);
      try {
        const res = await fetch("/api/transactions/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: description.trim(), createIfMissing: true }),
        });
        if (res.ok) {
          const data = await res.json() as {
            categoryId: string | null;
            newCategory?: { id: string; user_id: string; name: string; type: TransactionType; created_at: string };
          };
          if (data.categoryId && !categoryManuallySet.current) {
            // If a brand-new category was created, add it to the local list
            if (data.newCategory) {
              const safeNewCat: Category = {
                icon: null,
                monthly_budget: null,
                is_recurring: false,
                due_day: null,
                priority: null,
                notes: null,
                ...data.newCategory,
                type: data.newCategory.type as TransactionType,
              };
              setCategories((prev) =>
                prev.some((c) => c.id === safeNewCat.id)
                  ? prev
                  : [...prev, safeNewCat]
              );
            }
            setCategoryId(data.categoryId);
            setIsAISuggested(true);
          }
        }
      } catch {
        // Fail silently
      } finally {
        setIsCategorizingAI(false);
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  // Auto-detect transfer when a transfer-type category is selected
  function handleCategoryChange(newCategoryId: string) {
    categoryManuallySet.current = true;
    setIsAISuggested(false);
    setCategoryId(newCategoryId);
    const selectedCat = categories.find((c) => c.id === newCategoryId);
    if (selectedCat?.type === "transfer") {
      setMode("transfer");
      setCrDr("debit");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !amount) return;
    if (mode === "transfer" && !targetAccountId) return;
    onSave({
      description,
      amount_usd: parseFloat(amount),
      cr_dr: mode === "income" ? "credit" : "debit",
      account_id: accountId,
      category_id: mode === "transfer" ? null : (categoryId || null),
      date,
      notes: notes || null,
      loan_id: mode === "transfer" ? null : (loanId || null),
      target_account_id: mode === "transfer" ? targetAccountId : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">
            {txn ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${
                mode === "expense"
                  ? "bg-[var(--color-danger)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              }`}
              onClick={() => { setMode("expense"); setCrDr("debit"); }}
            >
              Expense
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${
                mode === "income"
                  ? "bg-[var(--color-income)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              }`}
              onClick={() => { setMode("income"); setCrDr("credit"); }}
            >
              Income
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${
                mode === "transfer"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              }`}
              onClick={() => { setMode("transfer"); setCrDr("debit"); }}
            >
              Transfer
            </button>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
              Description
            </label>
            <input
              type="text"
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              placeholder="e.g. Whole Foods Market"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                Date
              </label>
              <input
                type="date"
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={mode === "transfer" ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                {mode === "transfer" ? "From Account" : "Account"}
              </label>
              <select
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {mode === "transfer" && (
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                  To Account
                </label>
                <select
                  className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  required
                >
                  <option value="">Select destination</option>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {mode === "transfer" && targetAccountId && (
            <p className="text-[0.65rem] text-[var(--color-accent)] -mt-2">
              A paired credit entry will be auto-created on the target account.
            </p>
          )}

          {mode !== "transfer" && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-xs text-[var(--color-text-muted)]">
                Category
              </label>
              {isCategorizingAI && (
                <span className="text-xs text-[var(--color-text-secondary)] animate-pulse">
                  Detecting…
                </span>
              )}
              {isAISuggested && !isCategorizingAI && (
                <span className="inline-flex items-center gap-0.5 text-xs text-[var(--color-accent)]">
                  <Sparkles className="h-3 w-3" />
                  AI
                </span>
              )}
            </div>
            <select
              className={`w-full h-9 rounded-lg border px-3 text-sm bg-[var(--color-bg-tertiary)] transition-colors ${
                isAISuggested
                  ? "border-[var(--color-accent)]/60"
                  : "border-[var(--color-border)]"
              }`}
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          )}

          {loans.length > 0 && mode === "expense" && (
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                Link to Loan (optional)
              </label>
              <select
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
              >
                <option value="">— No loan link —</option>
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} (bal: {formatCurrency(l.current_balance)})
                  </option>
                ))}
              </select>
              {loanId && (
                <p className="text-[0.65rem] text-amber-400 mt-1">
                  This payment will reduce the selected loan balance.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
              Notes (optional)
            </label>
            <input
              type="text"
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {txn ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
