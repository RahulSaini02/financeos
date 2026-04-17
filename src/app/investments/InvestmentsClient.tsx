"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import type { Investment, SavingsGoal } from "@/lib/types";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvestmentForm {
  type: string;
  platform: string;
  ticker: string;
  total_invested: string;
  current_value: string;
  account_id: string;
  notes: string;
}

const emptyForm: InvestmentForm = {
  type: "",
  platform: "",
  ticker: "",
  total_invested: "",
  current_value: "",
  account_id: "",
  notes: "",
};

const COMMON_TYPES = ["ETF", "Stock", "401K", "Roth IRA", "Crypto", "Index Fund", "Bond", "ESPP", "Other"];

interface AccountOption { id: string; name: string; }

// ── Investment Modal ──────────────────────────────────────────────────────────

function InvestmentModal({
  editing,
  accounts,
  onSave,
  onClose,
  saving,
}: {
  editing: Investment | null;
  accounts: AccountOption[];
  onSave: (form: InvestmentForm) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<InvestmentForm>(
    editing
      ? {
          type: editing.type,
          platform: editing.platform,
          ticker: editing.ticker,
          total_invested: String(editing.total_invested),
          current_value: String(editing.current_value),
          account_id: editing.account_id ?? "",
          notes: editing.notes ?? "",
        }
      : emptyForm
  );

  const inputClass =
    "w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold">{editing ? "Edit Investment" : "Add Investment"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--color-bg-tertiary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Type</label>
              <input
                list="inv-types"
                className={inputClass}
                placeholder="ETF, Stock, 401K..."
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              />
              <datalist id="inv-types">
                {COMMON_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Platform</label>
              <input
                className={inputClass}
                placeholder="Fidelity, Robinhood..."
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Ticker / Name</label>
            <input
              className={inputClass}
              placeholder="e.g. FXAIX, BTC, My 401K"
              value={form.ticker}
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Total Invested ($)</label>
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                className={inputClass}
                value={form.total_invested}
                onChange={(e) => setForm((f) => ({ ...f, total_invested: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Current Value ($)</label>
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                className={inputClass}
                value={form.current_value}
                onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Linked Account <span className="text-[var(--color-text-muted)] font-normal">(optional — balance synced from account)</span></label>
            <select
              className={inputClass}
              value={form.account_id}
              onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
            >
              <option value="">— No linked account —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={saving || !form.type.trim() || !form.platform.trim() || !form.ticker.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            {editing ? "Save Changes" : "Add Investment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function gainPct(invested: number, current: number): number {
  if (invested === 0) return 0;
  return ((current - invested) / invested) * 100;
}

function monthsToGoal(target: number, current: number, monthly: number): number {
  if (monthly <= 0 || current >= target) return 0;
  return Math.ceil((target - current) / monthly);
}

const typeColors: Record<string, { bg: string; text: string }> = {
  ETF: { bg: "bg-violet-500/10", text: "text-violet-400" },
  Stock: { bg: "bg-blue-500/10", text: "text-blue-400" },
  "401K": { bg: "bg-amber-500/10", text: "text-amber-400" },
  "401K (7584)": { bg: "bg-amber-500/10", text: "text-amber-400" },
};

function getTypeStyle(type: string) {
  return typeColors[type] ?? { bg: "bg-[var(--color-accent)]/10", text: "text-[var(--color-accent)]" };
}

// ── component ─────────────────────────────────────────────────────────────────

interface InvestmentsClientProps {
  initialInvestments: Investment[];
  accounts: AccountOption[];
}

export function InvestmentsClient({ initialInvestments, accounts }: InvestmentsClientProps) {
  const supabase = createClient();

  const [investments, setInvestments] = useState<Investment[]>(initialInvestments);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refetch() {
    const [{ data: inv }, { data: goalsData }] = await Promise.all([
      supabase
        .from("investments")
        .select("*, account:accounts(id, name, current_balance)")
        .order("current_value", { ascending: false }),
      supabase
        .from("savings_goals")
        .select("*, account:accounts!savings_goals_linked_account_id_fkey(id, name, current_balance)")
        .order("created_at"),
    ]);
    setInvestments(inv ?? []);
    setGoals(goalsData ?? []);
  }

  async function handleSave(form: InvestmentForm) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      type: form.type.trim(),
      platform: form.platform.trim(),
      ticker: form.ticker.trim(),
      total_invested: parseFloat(form.total_invested) || 0,
      current_value: parseFloat(form.current_value) || 0,
      account_id: form.account_id || null,
      notes: form.notes.trim() || null,
      last_updated: new Date().toISOString().split("T")[0],
    };

    if (editingInv) {
      await supabase.from("investments").update(payload).eq("id", editingInv.id);
    } else {
      await supabase.from("investments").insert(payload);
    }

    // Sync linked account balance
    const accountsToSync = new Set<string>();
    if (form.account_id) accountsToSync.add(form.account_id);
    if (editingInv?.account_id && editingInv.account_id !== form.account_id) {
      accountsToSync.add(editingInv.account_id);
    }
    for (const acctId of accountsToSync) {
      const { data: siblings } = await supabase
        .from("investments")
        .select("current_value")
        .eq("user_id", user.id)
        .eq("account_id", acctId);
      const total = (siblings ?? []).reduce((s, i) => s + (i.current_value ?? 0), 0);
      await supabase
        .from("accounts")
        .update({ current_balance: total, last_updated: new Date().toISOString().split("T")[0] })
        .eq("id", acctId)
        .eq("user_id", user.id);
    }

    setSaving(false);
    setShowModal(false);
    setEditingInv(null);
    await refetch();
  }

  async function handleDelete(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setDeleting(true);
    const deletingInv = investments.find((i) => i.id === id);
    await supabase.from("investments").delete().eq("id", id).eq("user_id", user.id);

    if (deletingInv?.account_id) {
      const { data: remaining } = await supabase
        .from("investments")
        .select("current_value")
        .eq("user_id", user.id)
        .eq("account_id", deletingInv.account_id);
      const total = (remaining ?? []).reduce((s, i) => s + (i.current_value ?? 0), 0);
      await supabase
        .from("accounts")
        .update({ current_balance: total, last_updated: new Date().toISOString().split("T")[0] })
        .eq("id", deletingInv.account_id)
        .eq("user_id", user.id);
    }

    setDeleting(false);
    setConfirmDeleteId(null);
    setInvestments((prev) => prev.filter((i) => i.id !== id));
  }

  const totals = useMemo(() => {
    const totalInvested = investments.reduce((s, i) => s + i.total_invested, 0);
    const totalValue = investments.reduce((s, i) => s + i.current_value, 0);
    const totalGain = totalValue - totalInvested;
    const totalReturnPct = gainPct(totalInvested, totalValue);
    return { totalInvested, totalValue, totalGain, totalReturnPct };
  }, [investments]);

  // Group by platform
  const byPlatform = useMemo(() => {
    const map: Record<string, Investment[]> = {};
    investments.forEach((inv) => {
      if (!map[inv.platform]) map[inv.platform] = [];
      map[inv.platform].push(inv);
    });
    return map;
  }, [investments]);

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
      <PageHeader
        title="Investments"
        subtitle="Portfolio performance and savings goals"
        tooltip={
          <HelpModal
            title="Investments"
            description="Track your investment portfolio across platforms and asset classes — stocks, ETFs, crypto, retirement accounts, and more. Monitor total invested vs. current value."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Add each investment with its ticker, platform, and current value",
                  "Update the current value periodically to keep your net worth accurate",
                  "FinanceOS tracks total invested and current value to show gain/loss",
                  "Link investments to an account for balance tracking",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add Investment — log a new holding or asset",
                  "Edit — update current value or add notes",
                  "Delete — remove an investment you have fully exited",
                ],
              },
            ]}
          />
        }
      >
        <Button onClick={() => { setEditingInv(null); setShowModal(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Investment
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Portfolio Value</CardTitle>
          <CardValue className="mt-2">{formatCurrency(totals.totalValue)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total Invested</CardTitle>
          <CardValue className="mt-2">{formatCurrency(totals.totalInvested)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total Gain / Loss</CardTitle>
          <CardValue
            className={`mt-2 ${
              totals.totalGain >= 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {totals.totalGain >= 0 ? "+" : ""}
            {formatCurrency(totals.totalGain)}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Total Return</CardTitle>
          <CardValue
            className={`mt-2 ${
              totals.totalReturnPct >= 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {totals.totalReturnPct >= 0 ? "+" : ""}
            {totals.totalReturnPct.toFixed(2)}%
          </CardValue>
        </Card>
      </div>

      {/* Holdings by platform */}
      {investments.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          title="No investments found"
          description="Add your first investment to track portfolio performance."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(byPlatform).map(([platform, positions]) => {
            const platformValue = positions.reduce(
              (s, i) => s + i.current_value,
              0
            );
            const platformInvested = positions.reduce(
              (s, i) => s + i.total_invested,
              0
            );
            const platformGain = platformValue - platformInvested;
            const platformPct = gainPct(platformInvested, platformValue);

            return (
              <div key={platform}>
                {/* Platform header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">{platform}</h2>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">
                      {formatCurrency(platformValue)}
                    </span>
                    <span
                      className={`flex items-center gap-0.5 font-medium ${
                        platformGain >= 0
                          ? "text-[var(--color-success)]"
                          : "text-[var(--color-danger)]"
                      }`}
                    >
                      {platformGain >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {platformPct >= 0 ? "+" : ""}
                      {platformPct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {positions.map((inv) => {
                    const invWithAcct = inv as Investment & { account?: { id: string; name: string; current_balance: number } | null }
                    const liveValue = inv.current_value;
                    const gain = liveValue - inv.total_invested;
                    const pct = gainPct(inv.total_invested, liveValue);
                    const typeStyle = getTypeStyle(inv.type);
                    const isGain = gain >= 0;

                    return (
                      <Card key={inv.id}>
                        {/* Ticker + type + actions */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-lg leading-none">
                              {inv.ticker}
                            </p>
                            <span
                              className={`mt-1 inline-block text-[0.65rem] font-medium px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}
                            >
                              {inv.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingInv(inv); setShowModal(true); }}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(inv.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Value */}
                        <p className="text-xl font-semibold">
                          {formatCurrency(liveValue)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Invested: {formatCurrency(inv.total_invested)}
                        </p>
                        {invWithAcct.account && (
                          <p className="text-[10px] text-[var(--color-accent)] mt-0.5">
                            ⟳ {invWithAcct.account.name}
                          </p>
                        )}

                        {/* Gain/loss pill */}
                        <div
                          className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                            isGain
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-danger)]"
                          }`}
                        >
                          {isGain ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {isGain ? "+" : ""}
                          {formatCurrency(gain)} ({pct >= 0 ? "+" : ""}
                          {pct.toFixed(2)}%)
                        </div>

                        {/* Last updated */}
                        {inv.last_updated && (
                          <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-2">
                            Updated{" "}
                            {new Date(inv.last_updated).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric", year: "numeric" }
                            )}
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <InvestmentModal
          editing={editingInv}
          accounts={accounts}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingInv(null); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        title="Delete this investment?"
        description="This will permanently remove it from your portfolio. This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />

      {/* Savings Goals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Savings Goals</h2>
        </div>

        {goals.length === 0 ? (
          <EmptyState
            icon={<Target className="h-8 w-8" />}
            title="No savings goals yet"
            description="Add a savings goal to track your progress."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => {
              const goalWithAcct = goal as typeof goal & { account?: { id: string; name: string; current_balance: number } | null }
              const effectiveCurrent = goalWithAcct.account?.current_balance ?? goal.current_amount
              const pct =
                goal.target_amount > 0
                  ? Math.min(
                      (effectiveCurrent / goal.target_amount) * 100,
                      100
                    )
                  : 0;
              const remaining = goal.target_amount - effectiveCurrent;
              const months = monthsToGoal(
                goal.target_amount,
                effectiveCurrent,
                goal.monthly_contribution
              );

              return (
                <Card key={goal.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {goal.icon && (
                        <span className="text-2xl">{goal.icon}</span>
                      )}
                      <div>
                        <p className="font-medium">{goal.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {goal.monthly_contribution > 0
                            ? `${formatCurrency(goal.monthly_contribution)} / mo`
                            : "No contribution set"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        goal.status === "completed"
                          ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                          : goal.status === "paused"
                          ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                          : "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      }`}
                    >
                      {goal.status}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xl font-semibold">
                        {formatCurrency(effectiveCurrent)}
                      </p>
                      {goalWithAcct.account && (
                        <p className="text-[10px] text-[var(--color-accent)]">⟳ {goalWithAcct.account.name}</p>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      / {formatCurrency(goal.target_amount)}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100
                          ? "bg-[var(--color-success)]"
                          : "bg-[var(--color-accent)]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-[var(--color-text-muted)]">
                    <span>{pct.toFixed(0)}% funded</span>
                    {remaining > 0 ? (
                      <span>
                        {formatCurrency(remaining)} to go
                        {months > 0 && ` · ~${months}mo`}
                      </span>
                    ) : (
                      <span className="text-[var(--color-success)]">
                        Goal reached!
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
