"use client";

import { useState } from "react";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import type { RecurringRule, CrDr } from "@/lib/types";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Repeat,
  Calendar,
  DollarSign,
  PackageOpen,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

type FrequencyOption = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annually" | "yearly";

const FREQUENCY_OPTIONS: { value: FrequencyOption; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
  { value: "yearly", label: "Yearly" },
];

const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}${getDaySuffix(i + 1)}`,
}));

function getDaySuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

interface AccountOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

function statusBadge(isActive: boolean) {
  return <StatusBadge label={isActive ? "Active" : "Paused"} variant={isActive ? "success" : "muted"} />;
}

function getFrequencyLabel(freq: FrequencyOption, dayOfMonth: number | null): string {
  switch (freq) {
    case "daily": return "Every day";
    case "weekly": return "Every week";
    case "biweekly": return "Every 2 weeks";
    case "monthly": return dayOfMonth ? `Monthly on the ${dayOfMonth}${getDaySuffix(dayOfMonth)}` : "Monthly";
    case "quarterly": return "Every 3 months";
    case "annually":
    case "yearly": return "Every year";
    default: return freq;
  }
}

interface RecurringRuleFormData {
  description: string;
  amount_usd: string;
  cr_dr: CrDr;
  frequency: FrequencyOption;
  day_of_month: number | null;
  next_due: string;
  is_active: boolean;
  account_id: string;
  target_account_id: string;
  category_id: string;
  notes: string;
}

const emptyForm: RecurringRuleFormData = {
  description: "",
  amount_usd: "",
  cr_dr: "debit",
  frequency: "monthly",
  day_of_month: 1,
  next_due: "",
  is_active: true,
  account_id: "",
  target_account_id: "",
  category_id: "",
  notes: "",
};

function RecurringRuleModal({
  editingRule,
  accounts,
  categories,
  onClose,
  onSaved,
}: {
  editingRule: RecurringRule | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState<RecurringRuleFormData>(() => {
    if (editingRule) {
      return {
        description: editingRule.description,
        amount_usd: editingRule.amount_usd.toString(),
        cr_dr: editingRule.cr_dr,
        frequency: editingRule.frequency as FrequencyOption,
        day_of_month: editingRule.day_of_month,
        next_due: editingRule.next_due,
        is_active: editingRule.is_active,
        account_id: editingRule.account_id,
        target_account_id: editingRule.target_account_id ?? "",
        category_id: editingRule.category_id ?? "",
        notes: editingRule.notes ?? "",
      };
    }
    return { ...emptyForm, next_due: new Date().toISOString().split("T")[0] };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      description: form.description.trim(),
      amount_usd: parseFloat(form.amount_usd),
      cr_dr: form.cr_dr,
      frequency: form.frequency,
      day_of_month: form.day_of_month,
      next_due: form.next_due,
      is_active: form.is_active,
      account_id: form.account_id || null,
      target_account_id: form.target_account_id || null,
      category_id: form.category_id || null,
      notes: form.notes.trim() || null,
    };

    let err;
    if (editingRule) {
      ({ error: err } = await supabase
        .from("recurring_rules")
        .update(payload)
        .eq("id", editingRule.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      ({ error: err } = await supabase
        .from("recurring_rules")
        .insert({ ...payload, user_id: user.id }));
    }

    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      onSaved();
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-[var(--color-bg-secondary)] py-2">
          <h2 className="text-lg font-semibold">
            {editingRule ? "Edit Recurring Rule" : "Add Recurring Rule"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <X className="h-5 w-5 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Description
            </label>
            <input
              type="text"
              placeholder="e.g., Netflix Subscription, Rent..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Amount ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="9.99"
                value={form.amount_usd}
                onChange={(e) => setForm((f) => ({ ...f, amount_usd: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Type
              </label>
              <select
                value={form.cr_dr}
                onChange={(e) => setForm((f) => ({ ...f, cr_dr: e.target.value as CrDr }))}
                className={inputClass}
              >
                <option value="debit">Expense (Debit)</option>
                <option value="credit">Income (Credit)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Frequency
              </label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as FrequencyOption }))}
                className={inputClass}
              >
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {form.frequency === "monthly" && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Day of Month
                </label>
                <select
                  value={form.day_of_month ?? 1}
                  onChange={(e) => setForm((f) => ({ ...f, day_of_month: parseInt(e.target.value) }))}
                  className={inputClass}
                >
                  {DAY_OF_MONTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Next Due Date
            </label>
            <input
              type="date"
              value={form.next_due}
              onChange={(e) => setForm((f) => ({ ...f, next_due: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                From Account
              </label>
              <select
                value={form.account_id}
                onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Category
              </label>
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Transfer To (optional — for recurring inter-account transfers)
            </label>
            <select
              value={form.target_account_id}
              onChange={(e) => setForm((f) => ({ ...f, target_account_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Not a transfer —</option>
              {accounts
                .filter((a) => a.id !== form.account_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
            {form.target_account_id && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                A paired debit + credit will be created on each due date.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="text-sm text-[var(--color-text-secondary)]">Active Rule</label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-[var(--color-text-muted)]">
                {form.is_active ? "On" : "Off"}
              </span>
              {form.is_active ? (
                <ToggleRight className="h-6 w-6 text-[var(--color-success)]" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-[var(--color-text-muted)]" />
              )}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={saving || !form.description || !form.amount_usd}
              onClick={handleSubmit}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingRule ? (
                "Save Changes"
              ) : (
                "Add Rule"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NextOccurrences({ rule }: { rule: RecurringRule }) {
  const getNextOccurrences = () => {
    const occurrences: Date[] = [];
    const date = new Date(rule.next_due);

    for (let i = 0; i < 3; i++) {
      occurrences.push(new Date(date));
      switch (rule.frequency) {
        case "daily":
          date.setDate(date.getDate() + 1);
          break;
        case "weekly":
          date.setDate(date.getDate() + 7);
          break;
        case "monthly":
          date.setMonth(date.getMonth() + 1);
          if (rule.day_of_month) date.setDate(rule.day_of_month);
          break;
        case "yearly":
          date.setFullYear(date.getFullYear() + 1);
          break;
      }
    }
    return occurrences;
  };

  const occurrences = getNextOccurrences();

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
      <Calendar className="h-3 w-3" />
      <span>Next:</span>
      <span className="font-medium">{formatDate(rule.next_due)}</span>
      <span className="text-[var(--color-text-muted)]">
        ({occurrences.slice(1).map((d) => formatDate(d.toISOString().split("T")[0])).join(", ")})
      </span>
    </div>
  );
}

interface RecurringClientProps {
  initialRules: RecurringRule[];
  accounts: AccountOption[];
  categories: CategoryOption[];
  initialAutoRenewSubs: {
    id: string;
    name: string;
    billing_cost: number;
    billing_cycle_months: number;
    next_billing_date: string | null;
    account_id: string | null;
  }[];
}

export function RecurringClient({
  initialRules,
  accounts,
  categories,
  initialAutoRenewSubs,
}: RecurringClientProps) {
  const supabase = createClient();

  const [rules, setRules] = useState<RecurringRule[]>(initialRules);
  const [autoRenewSubs] = useState(initialAutoRenewSubs);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  const fetchRules = async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("recurring_rules")
      .select("*")
      .order("next_due");
    if (err) {
      setError(err.message);
    } else {
      setRules(data ?? []);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recurring rule?")) return;
    const { error: err } = await supabase
      .from("recurring_rules")
      .delete()
      .eq("id", id);
    if (err) {
      alert(err.message);
    } else {
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleToggleActive = async (rule: RecurringRule) => {
    const { error: err } = await supabase
      .from("recurring_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    if (err) {
      alert(err.message);
    } else {
      setRules((prev) =>
        prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r)
      );
    }
  };

  const openAdd = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingRule(null);
    fetchRules();
  };

  const activeRules = rules.filter((r) => r.is_active);
  const totalMonthly = activeRules
    .filter((r) => r.frequency === "monthly")
    .reduce((sum, r) => sum + r.amount_usd, 0);

  const filteredRules = rules.filter((r) => {
    if (activeFilter === "all") return true;
    return r.is_active === (activeFilter === "active");
  });

  const TABS: { key: "all" | "active" | "inactive"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <PageHeader
        title="Recurring Rules"
        subtitle="Automate recurring transactions and bills"
        tooltip={
          <HelpModal
            title="Recurring Rules"
            description="Automate repeated transactions like rent, subscriptions, or salary deposits. Set a rule once and FinanceOS generates the transaction on the due date."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Create a rule for any transaction that repeats on a fixed schedule",
                  "Choose frequency: daily, weekly, monthly, or yearly",
                  "Set the next due date and the system will generate future transactions automatically",
                  "Deactivate a rule to pause it without deleting it",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add Rule — define a recurring income or expense",
                  "Edit — change the amount, frequency, or next due date",
                  "Toggle active — pause or resume a rule",
                  "Delete — remove a rule permanently",
                ],
              },
            ]}
          />
        }
      >
        <Button onClick={openAdd} size="md">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Rule
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Active Rules</CardTitle>
          <CardValue className="mt-2 text-[var(--color-success)]">
            {activeRules.length}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">recurring transactions</p>
        </Card>
        <Card>
          <CardTitle>Monthly Total</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {formatCurrency(totalMonthly)}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">from monthly rules</p>
        </Card>
        <Card>
          <CardTitle>Weekly Rules</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {activeRules.filter((r) => r.frequency === "weekly").length}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">recurring weekly</p>
        </Card>
        <Card>
          <CardTitle>Yearly Rules</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {activeRules.filter((r) => r.frequency === "yearly").length}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">recurring annually</p>
        </Card>
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeFilter === tab.key
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[var(--color-danger)]">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      ) : filteredRules.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-8 w-8" />}
          title="No recurring rules found"
          description={
            activeFilter === "all"
              ? "Add your first recurring rule to automate transactions."
              : `No ${activeFilter} recurring rules.`
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRules.map((rule) => (
            <Card
              key={rule.id}
              className="flex flex-col gap-3 hover:border-[var(--color-accent)]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <Repeat className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {rule.description}
                    </h3>
                    <div className="mt-1">{statusBadge(rule.is_active)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(rule)}
                    className="rounded-lg p-1.5 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="rounded-lg p-1.5 hover:bg-[var(--color-danger)]/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]" />
                  </button>
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)]">
                    {formatCurrency(rule.amount_usd)}
                  </span>
                  <span
                    className={`text-xs ml-1 ${
                      rule.cr_dr === "credit"
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    ({rule.cr_dr === "credit" ? "income" : "expense"})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Repeat className="h-3 w-3" />
                <span>{getFrequencyLabel(rule.frequency as FrequencyOption, rule.day_of_month)}</span>
              </div>

              <NextOccurrences rule={rule} />

              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                <button
                  onClick={() => handleToggleActive(rule)}
                  className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  {rule.is_active ? (
                    <>
                      <ToggleRight className="h-5 w-5 text-[var(--color-success)]" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-5 w-5 text-[var(--color-text-muted)]" />
                      <span>Activate</span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  <DollarSign className="h-3 w-3" />
                  <span>
                    {rule.frequency === "monthly"
                      ? formatCurrency(rule.amount_usd)
                      : rule.frequency === "weekly"
                      ? formatCurrency(rule.amount_usd * 4.33)
                      : rule.frequency === "yearly"
                      ? formatCurrency(rule.amount_usd / 12)
                      : formatCurrency(rule.amount_usd * 30)}
                    /mo est.
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Auto-renew Subscriptions section */}
      {autoRenewSubs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">
              Auto-renew Subscriptions
            </h2>
            <a
              href="/subscriptions"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Manage subscriptions →
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {autoRenewSubs.map((sub) => (
              <Card key={sub.id} className="flex flex-col gap-2 border-dashed opacity-90">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
                    <Repeat className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{sub.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatCurrency(sub.billing_cost)} / {sub.billing_cycle_months === 1 ? "month" : `${sub.billing_cycle_months} months`}
                    </p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)] font-medium whitespace-nowrap">
                    Auto-pay
                  </span>
                </div>
                {sub.next_billing_date && (
                  <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Next: {formatDate(sub.next_billing_date)}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <RecurringRuleModal
          editingRule={editingRule}
          accounts={accounts}
          categories={categories}
          onClose={() => {
            setModalOpen(false);
            setEditingRule(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
