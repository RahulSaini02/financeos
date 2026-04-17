"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import type { SavingsGoal, GoalStatus } from "@/lib/types";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Target,
  TrendingUp,
  CheckCircle2,
  PauseCircle,
  PackageOpen,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";

type FilterTab = "all" | GoalStatus;

interface AccountOption {
  id: string;
  name: string;
  current_balance: number;
}

const GOAL_STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const ICON_OPTIONS = [
  { value: "house", label: "House" },
  { value: "car", label: "Car" },
  { value: "plane", label: "Travel" },
  { value: "graduation-cap", label: "Education" },
  { value: "heart", label: "Emergency Fund" },
  { value: "gift", label: "Gift" },
  { value: "camera", label: "Electronics" },
  { value: "dumbbell", label: "Fitness" },
];

function getIconComponent(_iconName: string | null) {
  return <Target className="h-5 w-5" />;
}

function statusBadge(status: GoalStatus) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </span>
    );
  }
  if (status === "paused") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
        <PauseCircle className="h-3 w-3" />
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
      <CheckCircle2 className="h-3 w-3" />
      Completed
    </span>
  );
}

interface SavingsGoalFormData {
  name: string;
  target_amount: string;
  current_amount: string;
  monthly_contribution: string;
  status: GoalStatus;
  icon: string;
  notes: string;
  linked_account_id: string;
}

const emptyForm: SavingsGoalFormData = {
  name: "",
  target_amount: "",
  current_amount: "",
  monthly_contribution: "",
  status: "active",
  icon: "house",
  notes: "",
  linked_account_id: "",
};

function SavingsGoalModal({
  editingGoal,
  accounts,
  onClose,
  onSaved,
}: {
  editingGoal: SavingsGoal | null;
  accounts: AccountOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState<SavingsGoalFormData>(() => {
    if (editingGoal) {
      return {
        name: editingGoal.name,
        target_amount: editingGoal.target_amount.toString(),
        current_amount: editingGoal.current_amount.toString(),
        monthly_contribution: editingGoal.monthly_contribution.toString(),
        status: editingGoal.status,
        icon: editingGoal.icon ?? "house",
        notes: editingGoal.notes ?? "",
        linked_account_id: editingGoal.linked_account_id ?? "",
      };
    }
    return emptyForm;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount) || 0,
      monthly_contribution: parseFloat(form.monthly_contribution) || 0,
      status: form.status,
      icon: form.icon || null,
      notes: form.notes.trim() || null,
      linked_account_id: form.linked_account_id || null,
    };

    let err;
    if (editingGoal) {
      ({ error: err } = await supabase
        .from("savings_goals")
        .update(payload)
        .eq("id", editingGoal.id));
    } else {
      ({ error: err } = await supabase
        .from("savings_goals")
        .insert(payload));
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
            {editingGoal ? "Edit Savings Goal" : "Add Savings Goal"}
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
              Goal Name
            </label>
            <input
              required
              type="text"
              placeholder="Emergency Fund, New Car, Vacation..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Target Amount ($)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="10000"
                value={form.target_amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target_amount: e.target.value }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Current Amount ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.current_amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, current_amount: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Monthly Contribution ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="500"
              value={form.monthly_contribution}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthly_contribution: e.target.value }))
              }
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Icon
              </label>
              <select
                value={form.icon}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    icon: e.target.value,
                  }))
                }
                className={inputClass}
              >
                {ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as GoalStatus,
                  }))
                }
                className={inputClass}
              >
                {GOAL_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Linked Account <span className="text-[var(--color-text-muted)] font-normal">(optional — tracks balance as progress)</span>
            </label>
            <select
              value={form.linked_account_id}
              onChange={(e) => setForm((f) => ({ ...f, linked_account_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">— None —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (${a.current_balance.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="Optional notes..."
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
              ) : editingGoal ? (
                "Save Changes"
              ) : (
                "Add Goal"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SavingsGoalsClientProps {
  initialGoals: SavingsGoal[];
  accounts: AccountOption[];
}

export function SavingsGoalsClient({ initialGoals, accounts }: SavingsGoalsClientProps) {
  const supabase = createClient();

  const [goals, setGoals] = useState<SavingsGoal[]>(initialGoals);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [sortBy, setSortBy] = useState<"progress" | "target" | "name">("progress");

  const loadGoals = async () => {
    const { data, error: err } = await supabase
      .from("savings_goals")
      .select("*, account:accounts(id, name, current_balance)")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setGoals(data ?? []);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this savings goal?")) return;
    const { error: err } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", id);
    if (err) {
      alert(err.message);
    } else {
      setGoals((prev) => prev.filter((g) => g.id !== id));
    }
  };

  const openAdd = () => {
    setEditingGoal(null);
    setModalOpen(true);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingGoal(null);
    loadGoals();
  };

  const activeGoals = goals.filter((g) => g.status === "active");
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalCurrent = activeGoals.reduce((sum, g) => sum + g.current_amount, 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
  const totalMonthlyContribution = activeGoals.reduce(
    (sum, g) => sum + g.monthly_contribution,
    0
  );

  const filteredGoals = goals.filter((g) => {
    if (activeFilter === "all") return true;
    return g.status === activeFilter;
  });

  const sortedGoals = [...filteredGoals].sort((a, b) => {
    const progressA = a.target_amount > 0 ? a.current_amount / a.target_amount : 0;
    const progressB = b.target_amount > 0 ? b.current_amount / b.target_amount : 0;

    switch (sortBy) {
      case "progress":
        return progressB - progressA;
      case "target":
        return b.target_amount - a.target_amount;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "paused", label: "Paused" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <PageHeader
        title="Savings Goals"
        subtitle="Track progress towards your financial goals"
        tooltip={
          <HelpModal
            title="Savings Goals"
            description="Set and track savings goals — emergency fund, vacation, down payment, or any target you are working toward. See progress, monthly contributions, and estimated completion."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Create a goal with a target amount and monthly contribution",
                  "Link a savings account so the balance auto-syncs",
                  "The progress bar shows how close you are to reaching the goal",
                  "Pause a goal if you need to temporarily stop contributing",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add Goal — define a new savings target",
                  "Edit — update the target, contribution amount, or status",
                  "Pause / Complete — change the goal status as circumstances change",
                ],
              },
            ]}
          />
        }
      >
        <Button onClick={openAdd} size="md">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Goal
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Total Target</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {formatCurrency(totalTarget)}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            across active goals
          </p>
        </Card>
        <Card>
          <CardTitle>Total Saved</CardTitle>
          <CardValue className="mt-2 text-[var(--color-success)]">
            {formatCurrency(totalCurrent)}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {overallProgress.toFixed(1)}% of target
          </p>
        </Card>
        <Card>
          <CardTitle>Monthly Contribution</CardTitle>
          <CardValue className="mt-2 text-[var(--color-accent)]">
            {formatCurrency(totalMonthlyContribution)}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            auto-savings
          </p>
        </Card>
        <Card>
          <CardTitle>Active Goals</CardTitle>
          <CardValue className="mt-2 text-[var(--color-text-primary)]">
            {activeGoals.length}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {goals.filter((g) => g.status === "completed").length} completed
          </p>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
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
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="progress">Sort by Progress</option>
            <option value="target">Sort by Target Amount</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[var(--color-danger)]">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      ) : filteredGoals.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-8 w-8" />}
          title="No savings goals found"
          description={
            activeFilter === "all"
              ? "Add your first savings goal to get started."
              : `No ${activeFilter} savings goals.`
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedGoals.map((goal) => {
            const linkedAccount = goal.linked_account_id
              ? accounts.find((a) => a.id === goal.linked_account_id)
              : null;
            const effectiveCurrent = linkedAccount
              ? Math.max(linkedAccount.current_balance, 0)
              : goal.current_amount;
            const progress = goal.target_amount > 0
              ? (effectiveCurrent / goal.target_amount) * 100
              : 0;
            const isCompleted = progress >= 100;
            const remaining = goal.target_amount - effectiveCurrent;
            const monthsToGoal = goal.monthly_contribution > 0
              ? Math.ceil(remaining / goal.monthly_contribution)
              : null;

            return (
              <Card
                key={goal.id}
                className="flex flex-col gap-3 hover:border-[var(--color-accent)]/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                      {getIconComponent(goal.icon)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                        {goal.name}
                      </h3>
                      <div className="mt-1">{statusBadge(goal.status)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(goal)}
                      className="rounded-lg p-1.5 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="rounded-lg p-1.5 hover:bg-[var(--color-danger)]/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(effectiveCurrent)}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-1">
                      of {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                  {linkedAccount && (
                    <span className="text-xs text-[var(--color-accent)] flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {linkedAccount.name}
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                      isCompleted
                        ? "bg-[var(--color-success)]"
                        : progress >= 75
                        ? "bg-[var(--color-success)]"
                        : progress >= 50
                        ? "bg-[var(--color-warning)]"
                        : "bg-[var(--color-accent)]"
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    {progress.toFixed(1)}%
                  </span>
                  {isCompleted ? (
                    <span className="text-[var(--color-success)] font-medium">
                      Goal Achieved!
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">
                      {formatCurrency(remaining)} remaining
                    </span>
                  )}
                </div>

                {goal.monthly_contribution > 0 && !isCompleted && (
                  <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <TrendingUp className="h-3 w-3" />
                      <span>{formatCurrency(goal.monthly_contribution)}/mo</span>
                    </div>
                    {monthsToGoal && monthsToGoal > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        ~{monthsToGoal} months to goal
                      </span>
                    )}
                  </div>
                )}

                {goal.notes && (
                  <p className="text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
                    {goal.notes}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <SavingsGoalModal
          editingGoal={editingGoal}
          accounts={accounts}
          onClose={() => {
            setModalOpen(false);
            setEditingGoal(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
