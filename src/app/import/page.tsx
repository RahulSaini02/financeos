"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { PendingImport, Account, Category, CrDr, TxnSource } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Upload,
  Check,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Joined type from Supabase select
type PendingImportWithJoins = PendingImport & {
  suggested_category: Category | null;
  suggested_account: Account | null;
};

type TabKey = "pending" | "flagged" | "confirmed" | "rejected";

const TAB_LABELS: Record<TabKey, string> = {
  pending: "Pending",
  flagged: "Flagged",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

const SOURCE_BADGE: Record<TxnSource, { label: string; color: string }> = {
  n8n: { label: "n8n", color: "#a855f7" },
  import: { label: "import", color: "#3b82f6" },
  apple_pay: { label: "Apple Pay", color: "#6b7280" },
  manual: { label: "manual", color: "#22c55e" },
};

export default function ImportPage() {
  const { user } = useAuth();
  const [imports, setImports] = useState<PendingImportWithJoins[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [confirmingItem, setConfirmingItem] = useState<PendingImportWithJoins | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    if (!user) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const [importsRes, accountsRes, categoriesRes] = await Promise.all([
      supabase
        .from("pending_imports")
        .select("*, suggested_category:categories(*), suggested_account:accounts(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").eq("user_id", user.id).eq("is_active", true).order("name"),
      supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
    ]);

    if (importsRes.error) {
      setError(importsRes.error.message);
      setLoading(false);
      return;
    }

    setImports((importsRes.data ?? []) as PendingImportWithJoins[]);
    setAccounts(accountsRes.data ?? []);
    setCategories(categoriesRes.data ?? []);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // Stats
  const today = new Date().toISOString().split("T")[0];
  const stats = {
    pending: imports.filter((i) => i.status === "pending").length,
    flagged: imports.filter((i) => i.status === "flagged" || i.flagged).length,
    confirmedToday: imports.filter(
      (i) => i.status === "confirmed" && i.reviewed_at && i.reviewed_at.startsWith(today)
    ).length,
    total: imports.length,
  };

  // Tab items
  const tabItems = imports.filter((i) => {
    if (activeTab === "pending") return i.status === "pending" && !i.flagged;
    if (activeTab === "flagged") return i.status === "flagged" || (i.flagged && i.status === "pending");
    if (activeTab === "confirmed") return i.status === "confirmed";
    if (activeTab === "rejected") return i.status === "rejected";
    return false;
  });

  // Reject handler
  async function handleReject(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("pending_imports")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      showToast("Failed to reject: " + error.message);
      return;
    }
    setImports((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "rejected", reviewed_at: new Date().toISOString() } : i
      )
    );
    setRejectingId(null);
    showToast("Import rejected.");
  }

  // Mark safe handler
  async function handleMarkSafe(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("pending_imports")
      .update({ flagged: false, status: "pending", flagged_reason: null })
      .eq("id", id);
    if (error) {
      showToast("Failed to mark safe: " + error.message);
      return;
    }
    setImports((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, flagged: false, status: "pending", flagged_reason: null } : i
      )
    );
    showToast("Marked as safe.");
  }

  // CSV upload handler
  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setCsvLoading(true);

    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      showToast("CSV must have a header row and at least one data row.");
      setCsvLoading(false);
      return;
    }

    // Skip header row
    const dataLines = lines.slice(1);
    const supabase = createClient();
    let successCount = 0;

    for (const line of dataLines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const [date, description, amount, last_four] = cols;
      if (!date || !description || !amount) continue;

      const { error } = await supabase.from("pending_imports").insert({
        user_id: user.id,
        raw_data: { date, description, amount, last_four: last_four ?? null },
        parsed_merchant: description,
        parsed_amount: Math.abs(parseFloat(amount)),
        parsed_date: date,
        parsed_last_four: last_four?.slice(-4) ?? null,
        source: "import" as TxnSource,
        status: "pending",
      });
      if (!error) successCount++;
    }

    showToast(`${successCount} row${successCount !== 1 ? "s" : ""} imported.`);
    setCsvLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
  }

  if (loading) return <TablePageSkeleton rows={6} />;

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
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Import Review</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            <span className="text-[var(--color-accent)]">{stats.pending} pending</span>
            {" · "}
            <span className="text-[var(--color-warning)]">{stats.flagged} flagged</span>
            {" · "}
            <span className="text-[var(--color-success)]">{stats.confirmedToday} confirmed today</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleCsvUpload}
              disabled={csvLoading}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={csvLoading}
              type="button"
            >
              {csvLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1.5" />
              )}
              Upload CSV
            </Button>
          </label>
        </div>
      </div>

      {/* CSV format hint */}
      <p className="text-xs text-[var(--color-text-muted)]">
        CSV format: <code className="bg-[var(--color-bg-tertiary)] px-1 rounded">date,description,amount,account_last_four</code>
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {TAB_LABELS[tab]}
            <span
              className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                activeTab === tab
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
              }`}
            >
              {tab === "pending" && stats.pending}
              {tab === "flagged" && stats.flagged}
              {tab === "confirmed" && imports.filter((i) => i.status === "confirmed").length}
              {tab === "rejected" && imports.filter((i) => i.status === "rejected").length}
            </span>
          </button>
        ))}
      </div>

      {/* Cards */}
      {tabItems.length === 0 ? (
        <EmptyState tab={activeTab} onUpload={() => fileInputRef.current?.click()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {tabItems.map((item) => (
            <ImportCard
              key={item.id}
              item={item}
              accounts={accounts}
              categories={categories}
              onConfirm={() => setConfirmingItem(item)}
              onReject={() => setRejectingId(item.id)}
              onMarkSafe={() => handleMarkSafe(item.id)}
              showActions={item.status === "pending" || item.status === "flagged"}
            />
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmingItem && (
        <ConfirmModal
          item={confirmingItem}
          accounts={accounts}
          categories={categories}
          userId={user?.id ?? ""}
          onConfirmed={(updatedItem) => {
            setImports((prev) =>
              prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
            );
            setConfirmingItem(null);
            showToast("Transaction confirmed.");
          }}
          onClose={() => setConfirmingItem(null)}
          onError={(msg) => showToast(msg)}
        />
      )}

      {/* Reject Dialog */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-danger)]/10">
                <X className="h-5 w-5 text-[var(--color-danger)]" />
              </div>
              <div>
                <h3 className="font-semibold">Reject this import?</h3>
                <p className="text-xs text-[var(--color-text-muted)]">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => handleReject(rejectingId)}>
                Reject
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Import Card ────────────────────────────────────────────────────────────

function ImportCard({
  item,
  accounts,
  categories,
  onConfirm,
  onReject,
  onMarkSafe,
  showActions,
}: {
  item: PendingImportWithJoins;
  accounts: Account[];
  categories: Category[];
  onConfirm: () => void;
  onReject: () => void;
  onMarkSafe: () => void;
  showActions: boolean;
}) {
  const sourceBadge = SOURCE_BADGE[item.source] ?? { label: item.source, color: "#6b7280" };

  const account = item.suggested_account ?? accounts.find((a) => a.id === item.suggested_account_id);
  const category = item.suggested_category ?? categories.find((c) => c.id === item.suggested_category_id);

  return (
    <Card className="flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{item.parsed_merchant ?? "Unknown Merchant"}</span>
            {(item.status === "flagged" || item.flagged) && (
              <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] shrink-0" />
            )}
            <span
              className="text-[0.65rem] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: sourceBadge.color + "22", color: sourceBadge.color }}
            >
              {sourceBadge.label}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {item.parsed_date ? formatDate(item.parsed_date) : "No date"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-lg font-semibold text-[var(--color-danger)]"
          >
            {item.parsed_amount != null ? formatCurrency(item.parsed_amount) : "—"}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">debit</p>
        </div>
      </div>

      {/* Account & Category */}
      <div className="flex flex-wrap gap-3 text-xs">
        {account && (
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <FileText className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <span>{account.name}</span>
            {account.last_four && (
              <span className="text-[var(--color-text-muted)]">···{account.last_four}</span>
            )}
          </div>
        )}
        {category && (
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <span>{category.icon ?? "🏷️"}</span>
            <span>{category.name}</span>
          </div>
        )}
      </div>

      {/* AI notes */}
      {item.ai_notes && (
        <p className="text-xs italic text-[var(--color-text-muted)] leading-relaxed">
          {item.ai_notes}
        </p>
      )}

      {/* Flagged reason */}
      {item.flagged_reason && (
        <div className="rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 px-3 py-2">
          <p className="text-xs text-[var(--color-warning)]">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {item.flagged_reason}
          </p>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-[var(--color-success)] text-white hover:opacity-90"
            onClick={onConfirm}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Confirm
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10" onClick={onReject}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Reject
          </Button>
          {(item.status === "flagged" || item.flagged) && (
            <Button variant="secondary" size="sm" onClick={onMarkSafe}>
              Mark Safe
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ tab, onUpload }: { tab: TabKey; onUpload: () => void }) {
  const messages: Record<TabKey, string> = {
    pending: "No pending imports. Upload a CSV to get started.",
    flagged: "No flagged imports. Everything looks clean!",
    confirmed: "No confirmed imports yet.",
    rejected: "No rejected imports.",
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] mb-4">
        <Upload className="h-6 w-6 text-[var(--color-text-muted)]" />
      </div>
      <p className="text-[var(--color-text-muted)] text-sm">{messages[tab]}</p>
      {tab === "pending" && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onUpload}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload CSV
        </Button>
      )}
    </div>
  );
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────

function ConfirmModal({
  item,
  accounts,
  categories,
  userId,
  onConfirmed,
  onClose,
  onError,
}: {
  item: PendingImportWithJoins;
  accounts: Account[];
  categories: Category[];
  userId: string;
  onConfirmed: (updated: PendingImportWithJoins) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [description, setDescription] = useState(item.parsed_merchant ?? "");
  const [amount, setAmount] = useState(item.parsed_amount?.toString() ?? "");
  const [date, setDate] = useState(item.parsed_date ?? new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState(
    item.suggested_account_id ?? accounts[0]?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(item.suggested_category_id ?? "");
  const [crDr, setCrDr] = useState<CrDr>("debit");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !amount || !accountId) return;
    setSaving(true);

    const supabase = createClient();
    const numAmount = parseFloat(amount);
    const finalAmount = crDr === "credit" ? numAmount : -numAmount;

    // 1. Insert transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: accountId,
        category_id: categoryId || null,
        description,
        amount_usd: numAmount,
        amount_original: numAmount,
        original_currency: "USD",
        cr_dr: crDr,
        final_amount: finalAmount,
        date,
        notes: notes || null,
        source: item.source,
        import_status: "confirmed",
        flagged: false,
        is_recurring: false,
      })
      .select()
      .single();

    if (txnError) {
      onError("Failed to create transaction: " + txnError.message);
      setSaving(false);
      return;
    }

    // 2. Update pending_import
    const { error: updateError } = await supabase
      .from("pending_imports")
      .update({
        status: "confirmed",
        transaction_id: txn.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      onError("Transaction created but failed to update import: " + updateError.message);
      setSaving(false);
      return;
    }

    onConfirmed({
      ...item,
      status: "confirmed",
      transaction_id: txn.id,
      reviewed_at: new Date().toISOString(),
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Confirm Import</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* cr_dr toggle */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                crDr === "debit"
                  ? "bg-[var(--color-danger)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              }`}
              onClick={() => setCrDr("debit")}
            >
              Debit (Expense)
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                crDr === "credit"
                  ? "bg-[var(--color-success)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              }`}
              onClick={() => setCrDr("credit")}
            >
              Credit (Income)
            </button>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Description</label>
            <input
              type="text"
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Date</label>
              <input
                type="date"
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Account</label>
            <select
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.last_four ? ` ···${a.last_four}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Category</label>
            <select
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Notes (optional)</label>
            <input
              type="text"
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {item.ai_notes && (
            <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
              <p className="text-xs text-[var(--color-text-muted)] italic">
                AI: {item.ai_notes}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[var(--color-success)] text-white hover:opacity-90"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirm Transaction
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
