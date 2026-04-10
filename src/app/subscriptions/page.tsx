"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Subscription, BillingStatus } from "@/lib/types";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
  DollarSign,
  CheckCircle2,
  PackageOpen,
} from "lucide-react";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/info-tooltip";

type FilterTab = "all" | BillingStatus;

const BILLING_CYCLE_OPTIONS = [
  { value: 1, label: "Monthly" },
  { value: 3, label: "Quarterly" },
  { value: 6, label: "Semi-annual" },
  { value: 12, label: "Yearly" },
];

function getBillingCycleLabel(months: number): string {
  const found = BILLING_CYCLE_OPTIONS.find((o) => o.value === months);
  if (found) return found.label;
  return `Every ${months} months`;
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDueBadgeStyle(days: number | null): string {
  if (days === null) return "text-[var(--color-text-muted)]";
  if (days <= 3) return "text-[var(--color-danger)]";
  if (days <= 7) return "text-[var(--color-warning)]";
  return "text-[var(--color-text-muted)]";
}

function statusBadge(status: BillingStatus) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </span>
    );
  }
  if (status === "inactive") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
      Cancelled
    </span>
  );
}

interface SubscriptionFormData {
  name: string;
  billing_cost: string;
  billing_cycle_months: number;
  next_billing_date: string;
  status: BillingStatus;
  auto_renew: boolean;
  notes: string;
}

const emptyForm: SubscriptionFormData = {
  name: "",
  billing_cost: "",
  billing_cycle_months: 1,
  next_billing_date: "",
  status: "active",
  auto_renew: true,
  notes: "",
};

function SubscriptionModal({
  editingSub,
  onClose,
  onSaved,
}: {
  editingSub: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const supabase = createClient();
  const [form, setForm] = useState<SubscriptionFormData>(() => {
    if (editingSub) {
      return {
        name: editingSub.name,
        billing_cost: editingSub.billing_cost.toString(),
        billing_cycle_months: editingSub.billing_cycle_months,
        next_billing_date: editingSub.next_billing_date ?? "",
        status: editingSub.status,
        auto_renew: editingSub.auto_renew,
        notes: editingSub.notes ?? "",
      };
    }
    return emptyForm;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      billing_cost: parseFloat(form.billing_cost),
      billing_cycle_months: form.billing_cycle_months,
      next_billing_date: form.next_billing_date || null,
      status: form.status,
      auto_renew: form.auto_renew,
      notes: form.notes.trim() || null,
    };

    let err;
    if (editingSub) {
      ({ error: err } = await supabase
        .from("subscriptions")
        .update(payload)
        .eq("id", editingSub.id));
    } else {
      ({ error: err } = await supabase
        .from("subscriptions")
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
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {editingSub ? "Edit Subscription" : "Add Subscription"}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Name
            </label>
            <input
              required
              type="text"
              placeholder="Netflix, Spotify…"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Cost ($)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="9.99"
                value={form.billing_cost}
                onChange={(e) =>
                  setForm((f) => ({ ...f, billing_cost: e.target.value }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Billing Cycle
              </label>
              <select
                value={form.billing_cycle_months}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    billing_cycle_months: parseInt(e.target.value),
                  }))
                }
                className={inputClass}
              >
                {BILLING_CYCLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Next Billing Date
            </label>
            <input
              type="date"
              value={form.next_billing_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, next_billing_date: e.target.value }))
              }
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as BillingStatus,
                  }))
                }
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.auto_renew}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, auto_renew: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Auto-renew
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="Optional notes…"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingSub ? (
                "Save Changes"
              ) : (
                "Add Subscription"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  const fetchSubscriptions = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("next_billing_date");
    if (err) {
      setError(err.message);
    } else {
      setSubscriptions(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchSubscriptions();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subscription?")) return;
    const { error: err } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", id);
    if (err) {
      alert(err.message);
    } else {
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const openAdd = () => {
    setEditingSub(null);
    setModalOpen(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingSub(null);
    fetchSubscriptions();
  };

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const monthlyCost = activeSubscriptions.reduce(
    (sum, s) => sum + s.billing_cost / s.billing_cycle_months,
    0
  );
  const annualCost = monthlyCost * 12;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekLater = new Date(today);
  weekLater.setDate(today.getDate() + 7);

  const dueThisWeek = subscriptions.filter((s) => {
    if (!s.next_billing_date) return false;
    const d = new Date(s.next_billing_date);
    d.setHours(0, 0, 0, 0);
    return d >= today && d <= weekLater;
  }).length;

  const filteredSubscriptions = subscriptions.filter((s) => {
    if (activeFilter === "all") return true;
    return s.status === activeFilter;
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "cancelled", label: "Cancelled" },
  ];

  if (loading) return <GridPageSkeleton cards={4} />;

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
              Subscriptions & Bills
            </h1>
            <InfoTooltip
              title="Subscriptions & Bills"
              description="Track all your recurring subscriptions and bills. Defaults to showing active subscriptions."
              howTo="Use the filter tabs to switch between Active, Inactive, or All subscriptions. Add new ones with the + button."
              keyActions={[
                "Add a new subscription or recurring bill",
                "Toggle between active / inactive / all views",
                "See total monthly and annual cost",
                "Track upcoming renewal dates",
              ]}
            />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Track your recurring subscriptions and bills
          </p>
        </div>
        <Button onClick={openAdd} size="md">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Subscription
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Monthly Cost</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {formatCurrency(monthlyCost)}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            active subscriptions
          </p>
        </Card>
        <Card>
          <CardTitle>Annual Cost</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {formatCurrency(annualCost)}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            projected yearly spend
          </p>
        </Card>
        <Card>
          <CardTitle>Active</CardTitle>
          <CardValue className="mt-2 text-[var(--color-success)]">
            {activeSubscriptions.length}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            subscriptions
          </p>
        </Card>
        <Card>
          <CardTitle>Due This Week</CardTitle>
          <CardValue
            className={`mt-2 ${
              dueThisWeek > 0
                ? "text-[var(--color-warning)]"
                : "text-[var(--color-text-primary)]"
            }`}
          >
            {dueThisWeek}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            upcoming renewals
          </p>
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
      ) : filteredSubscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="h-10 w-10 text-[var(--color-text-muted)] mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            No subscriptions found
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {activeFilter === "all"
              ? "Add your first subscription to get started."
              : `No ${activeFilter} subscriptions.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSubscriptions.map((sub) => {
            const monthlyCostSub = sub.billing_cost / sub.billing_cycle_months;
            const days = getDaysUntil(sub.next_billing_date);
            const dueBadgeClass = getDueBadgeStyle(days);

            return (
              <Card
                key={sub.id}
                className="flex flex-col gap-3 hover:border-[var(--color-accent)]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold truncate text-[var(--color-text-primary)]">
                      {sub.name}
                    </h3>
                    <div className="mt-1">{statusBadge(sub.status)}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(sub)}
                      className="rounded-lg p-1.5 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="rounded-lg p-1.5 hover:bg-[var(--color-danger)]/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(monthlyCostSub)}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">
                      /mo
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded-full px-2 py-0.5">
                    {getBillingCycleLabel(sub.billing_cycle_months)}
                  </span>
                </div>

                {sub.billing_cycle_months !== 1 && (
                  <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <DollarSign className="h-3 w-3" />
                    <span>{formatCurrency(sub.billing_cost)} billed {getBillingCycleLabel(sub.billing_cycle_months).toLowerCase()}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <Calendar className="h-3 w-3" />
                    {sub.next_billing_date ? (
                      <span>
                        {new Date(sub.next_billing_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : (
                      <span>No date set</span>
                    )}
                  </div>
                  <div className={`text-xs font-medium ${dueBadgeClass}`}>
                    {days === null
                      ? ""
                      : days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                      ? "Due today"
                      : `Due in ${days}d`}
                  </div>
                </div>

                {sub.auto_renew && (
                  <div className="flex items-center gap-1 text-xs text-[var(--color-accent)]">
                    <RefreshCw className="h-3 w-3" />
                    Auto-renews
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <SubscriptionModal
          editingSub={editingSub}
          onClose={() => {
            setModalOpen(false);
            setEditingSub(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
