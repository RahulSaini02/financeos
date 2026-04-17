"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { FormField, FormInput, FormSelect, FormTextarea } from "@/components/ui/form-field";
import {
  Plus,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  Tag,
} from "lucide-react";
import type { Category, TransactionType } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "None" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const TYPE_COLORS: Record<TransactionType, string> = {
  expense: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  income: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  transfer: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
};

interface CategoryForm {
  name: string;
  type: TransactionType;
  icon: string;
  monthly_budget: string;
  is_recurring: boolean;
  due_day: string;
  priority: string;
  notes: string;
}

const emptyForm: CategoryForm = {
  name: "",
  type: "expense",
  icon: "",
  monthly_budget: "",
  is_recurring: false,
  due_day: "",
  priority: "",
  notes: "",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function CategoriesClient({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const { success, error: toastError } = useToast();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<TransactionType | "all">("all");

  const fetchCategories = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCategories(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    }
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(cat: Category) {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      type: cat.type,
      icon: cat.icon ?? "",
      monthly_budget: cat.monthly_budget != null ? String(cat.monthly_budget) : "",
      is_recurring: cat.is_recurring,
      due_day: cat.due_day != null ? String(cat.due_day) : "",
      priority: cat.priority ?? "",
      notes: cat.notes ?? "",
    });
    setSaveError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setSaveError(null);
  }

  function field(key: keyof CategoryForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError("Category name is required."); return; }
    setSaving(true);
    setSaveError(null);

    const payload = {
      name: form.name.trim(),
      type: form.type,
      icon: form.icon.trim() || null,
      monthly_budget: form.monthly_budget ? parseFloat(form.monthly_budget) : null,
      is_recurring: form.is_recurring,
      due_day: form.due_day ? parseInt(form.due_day) : null,
      priority: form.priority || null,
      notes: form.notes.trim() || null,
    };

    try {
      const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      success(editingId ? "Category updated" : "Category added");
      closeModal();
      fetchCategories();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        success("Category deleted");
      } else {
        toastError("Failed to delete category");
      }
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = filterType === "all"
    ? categories
    : categories.filter((c) => c.type === filterType);

  // Group by type for display
  const grouped: Record<string, Category[]> = {};
  for (const cat of filtered) {
    if (!grouped[cat.type]) grouped[cat.type] = [];
    grouped[cat.type].push(cat);
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-[var(--color-danger)] p-6">
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Categories"
        subtitle={`${categories.length} ${categories.length === 1 ? "category" : "categories"} total`}
        tooltip={
          <HelpModal
            title="Categories"
            description="Categories label your transactions as expenses, income, or transfers. Well-organized categories make budgets, reports, and AI insights more accurate."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Create categories that match your real spending habits (e.g. Groceries, Rent, Salary)",
                  "Set an icon and type (expense / income / transfer) for each category",
                  "Mark a category as recurring if it repeats on a schedule, then set a due day",
                  "Set a monthly budget on the category itself as a quick alternative to the Budgets page",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add Category — create a new label for transactions",
                  "Edit — update name, icon, type, or budget",
                  "Delete — remove a category (transactions keep their old label)",
                  "Filter tabs — show only expense, income, or transfer categories",
                ],
              },
            ]}
          />
        }
      >
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Category
        </Button>
      </PageHeader>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "expense", "income", "transfer"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === t
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            {t !== "all" && (
              <span className="ml-1.5 opacity-70">
                {categories.filter((c) => c.type === t).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <EmptyState
          icon={<Tag className="h-8 w-8" />}
          title="No categories yet"
          description="Add categories to organize your transactions and budgets."
          action={{ label: "Add Category", onClick: openAdd }}
        />
      )}

      {/* Category groups */}
      {(["expense", "income", "transfer"] as TransactionType[])
        .filter((t) => grouped[t]?.length)
        .map((type) => (
          <div key={type}>
            {filterType === "all" && (
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                {type}s
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped[type].map((cat) => (
                <Card key={cat.id} className="group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-bg-tertiary)] text-lg shrink-0">
                        {cat.icon ?? "📦"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {cat.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => openEdit(cat)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        disabled={deletingId === cat.id}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
                      >
                        {deletingId === cat.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-medium ${TYPE_COLORS[cat.type]}`}>
                      {cat.type}
                    </span>
                    {cat.priority && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                        {cat.priority}
                      </span>
                    )}
                    {cat.is_recurring && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-medium bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
                        recurring
                      </span>
                    )}
                    {cat.monthly_budget != null && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                        ${cat.monthly_budget}/mo
                      </span>
                    )}
                  </div>

                  {cat.notes && (
                    <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                      {cat.notes}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}

      {/* Add / Edit modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Edit Category" : "Add Category"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editingId ? "Save Changes" : "Add Category"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Name" required>
                <FormInput
                  placeholder="e.g. Groceries"
                  value={form.name}
                  onChange={field("name")}
                  autoFocus
                />
              </FormField>
            </div>

            <FormField label="Type">
              <FormSelect value={form.type} onChange={field("type")}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FormSelect>
            </FormField>

            <FormField label="Icon (emoji)">
              <FormInput
                placeholder="🛒"
                value={form.icon}
                onChange={field("icon")}
              />
            </FormField>

            <FormField label="Priority">
              <FormSelect value={form.priority} onChange={field("priority")}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </FormSelect>
            </FormField>

            <FormField label="Monthly Budget ($)">
              <FormInput
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.monthly_budget}
                onChange={field("monthly_budget")}
              />
            </FormField>

            <FormField label="Due Day (1–31)">
              <FormInput
                type="number"
                min="1"
                max="31"
                placeholder="e.g. 15"
                value={form.due_day}
                onChange={field("due_day")}
                disabled={!form.is_recurring}
              />
            </FormField>

            <div className="col-span-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="is_recurring"
                checked={form.is_recurring}
                onChange={(e) => setForm((p) => ({ ...p, is_recurring: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
              />
              <label htmlFor="is_recurring" className="text-sm text-[var(--color-text-secondary)] cursor-pointer">
                Recurring category (bills, subscriptions)
              </label>
            </div>

            <div className="col-span-2">
              <FormField label="Notes">
                <FormTextarea
                  rows={2}
                  placeholder="Any additional notes…"
                  value={form.notes}
                  onChange={field("notes")}
                />
              </FormField>
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-[var(--color-danger)] text-sm bg-[var(--color-danger)]/10 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
