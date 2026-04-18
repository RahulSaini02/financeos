"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase";
import type { Employer, Account } from "@/lib/types";
import {
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Briefcase,
  MapPin,
  Phone,
  User,
  Hash,
  Pencil,
  Trash2,
  CalendarDays,
  BadgeCheck,
  Landmark,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";

// ── Form ──────────────────────────────────────────────────────────────────────

interface EmployerForm {
  name: string;
  alias: string;
  location: string;
  manager: string;
  ein: string;
  phone: string;
  hr_contact: string;
  my_start_date: string;
  grade: string;
  default_account_id: string;
  notes: string;
}

const emptyForm: EmployerForm = {
  name: "",
  alias: "",
  location: "",
  manager: "",
  ein: "",
  phone: "",
  hr_contact: "",
  my_start_date: "",
  grade: "",
  default_account_id: "",
  notes: "",
};

const inputClass =
  "w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]";

const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5";

// ── Helpers ───────────────────────────────────────────────────────────────────

function yearsOfExperience(startDate: string | null): string | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (totalMonths < 0) return null;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} mo`;
  if (months === 0) return `${years} yr${years !== 1 ? "s" : ""}`;
  return `${years} yr${years !== 1 ? "s" : ""} ${months} mo`;
}

// ── Detail row ────────────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-[var(--color-text-muted)] mt-0.5 shrink-0" />
      <div>
        <p className="text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
        <p className="text-sm text-[var(--color-text-primary)]">{value}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmployersClient({
  initialEmployers,
  initialAccounts,
  userId,
}: {
  initialEmployers: Employer[];
  initialAccounts: Account[];
  userId: string;
}) {
  const supabase = createClient();
  const { success, error: toastError } = useToast();

  const [employers, setEmployers] = useState<Employer[]>(initialEmployers);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEmployers = useCallback(async () => {
    setError(null);
    const [{ data, error: err }, { data: acctData }] = await Promise.all([
      supabase.from("employers").select("*").eq("user_id", userId).order("name"),
      supabase.from("accounts").select("*").eq("user_id", userId).eq("is_active", true).in("type", ["checking", "savings"]).order("name"),
    ]);
    if (err) setError(err.message);
    else setEmployers(data ?? []);
    setAccounts(acctData ?? []);
  }, [userId, supabase]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(emp: Employer) {
    setEditingId(emp.id);
    setForm({
      name: emp.name,
      alias: emp.alias ?? "",
      location: emp.location ?? "",
      manager: emp.manager ?? "",
      ein: emp.ein ?? "",
      phone: emp.phone ?? "",
      hr_contact: emp.hr_contact ?? "",
      my_start_date: emp.my_start_date ?? "",
      grade: emp.grade ?? "",
      default_account_id: emp.default_account_id ?? "",
      notes: emp.notes ?? "",
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

  function field(key: keyof EmployerForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError("Employer name is required."); return; }
    setSaving(true);
    setSaveError(null);

    const payload = {
      user_id: userId,
      name: form.name.trim(),
      alias: form.alias.trim() || null,
      location: form.location.trim() || null,
      manager: form.manager.trim() || null,
      ein: form.ein.trim() || null,
      phone: form.phone.trim() || null,
      hr_contact: form.hr_contact.trim() || null,
      my_start_date: form.my_start_date || null,
      grade: form.grade.trim() || null,
      default_account_id: form.default_account_id || null,
      notes: form.notes.trim() || null,
    };

    let err;
    if (editingId) {
      ({ error: err } = await supabase
        .from("employers")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingId));
    } else {
      ({ error: err } = await supabase.from("employers").insert(payload));
    }

    if (err) {
      setSaveError(err.message);
    } else {
      success(editingId ? "Employer updated" : "Employer added");
      closeModal();
      fetchEmployers();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error: err } = await supabase.from("employers").delete().eq("id", id);
    if (err) toastError("Failed to delete employer");
    else success("Employer deleted");
    setDeletingId(null);
    fetchEmployers();
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
        title="Employers"
        subtitle={`${employers.length} employer${employers.length !== 1 ? "s" : ""} on record`}
        tooltip={
          <HelpModal
            title="Employers"
            description="Store employer details including contact info, your start date, grade level, and a default deposit account. Used to auto-fill paycheck entries."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Add each employer you have worked for or currently work for",
                  "Set a default deposit account so paychecks auto-select the right account",
                  "Include HR contact and EIN for reference during tax season",
                  "Past employers are kept for paycheck history even after you leave",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add Employer — log a new employer record",
                  "Edit — update default account, contact info, or notes",
                  "Delete — remove an employer (historical paychecks are preserved)",
                ],
              },
            ]}
          />
        }
      >
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Employer
        </Button>
      </PageHeader>

      {/* Empty state */}
      {employers.length === 0 && (
        <EmptyState
          icon={<Briefcase className="h-8 w-8" />}
          title="No employers yet"
          description="Add your employer to link paychecks and store details like EIN, manager, and HR contact."
          action={{ label: "Add Employer", onClick: openAdd }}
        />
      )}

      {/* Employer cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employers.map((emp) => (
          <Card key={emp.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold text-sm shrink-0">
                  {(emp.alias ?? emp.name).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{emp.name}</p>
                    {yearsOfExperience(emp.my_start_date) && (
                      <span className="mt-0.5 sm:mt-0 inline-flex items-center self-start sm:self-auto px-2 py-0.5 rounded-full text-[0.65rem] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] whitespace-nowrap">
                        {yearsOfExperience(emp.my_start_date)}
                      </span>
                    )}
                  </div>
                  {emp.alias && (
                    <p className="text-xs text-[var(--color-text-muted)]">{emp.alias}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(emp)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(emp.id)}
                  disabled={deletingId === emp.id}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
                >
                  {deletingId === emp.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--color-border)] pt-3">
              <DetailRow icon={MapPin} label="Location" value={emp.location} />
              <DetailRow icon={User} label="Manager" value={emp.manager} />
              <DetailRow icon={Hash} label="EIN" value={emp.ein} />
              <DetailRow icon={Phone} label="Phone" value={emp.phone} />
              <DetailRow icon={User} label="HR Contact" value={emp.hr_contact} />
              <DetailRow icon={CalendarDays} label="Start Date" value={emp.my_start_date
                ? new Date(emp.my_start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
                : null}
              />
              <DetailRow icon={BadgeCheck} label="Grade / Level" value={emp.grade} />
              <DetailRow
                icon={Landmark}
                label="Default Deposit Account"
                value={accounts.find((a) => a.id === emp.default_account_id)?.name ?? null}
              />
              {emp.notes && (
                <div className="col-span-2">
                  <p className="text-[0.65rem] text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Notes</p>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{emp.notes}</p>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {editingId ? "Edit Employer" : "Add Employer"}
              </h2>
              <button onClick={closeModal} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="col-span-2">
                  <label className={labelClass}>Employer Name <span className="text-[var(--color-danger)]">*</span></label>
                  <input className={inputClass} placeholder="e.g. Tata Consultancy Services" value={form.name} onChange={field("name")} />
                </div>

                <div>
                  <label className={labelClass}>Alias / Short Name</label>
                  <input className={inputClass} placeholder="e.g. TCS" value={form.alias} onChange={field("alias")} />
                </div>

                <div>
                  <label className={labelClass}>Grade / Level</label>
                  <input className={inputClass} placeholder="e.g. Senior Engineer, L4" value={form.grade} onChange={field("grade")} />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Location</label>
                  <input className={inputClass} placeholder="e.g. San Jose, CA" value={form.location} onChange={field("location")} />
                </div>

                <div>
                  <label className={labelClass}>EIN (Employer ID Number)</label>
                  <input className={inputClass} placeholder="XX-XXXXXXX" value={form.ein} onChange={field("ein")} />
                </div>

                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input className={inputClass} placeholder="+1 (408) 000-0000" value={form.phone} onChange={field("phone")} />
                </div>

                <div>
                  <label className={labelClass}>Direct Manager</label>
                  <input className={inputClass} placeholder="Manager name" value={form.manager} onChange={field("manager")} />
                </div>

                <div>
                  <label className={labelClass}>HR Contact</label>
                  <input className={inputClass} placeholder="HR name or email" value={form.hr_contact} onChange={field("hr_contact")} />
                </div>

                <div>
                  <label className={labelClass}>My Start Date</label>
                  <input type="date" className={inputClass} value={form.my_start_date} onChange={field("my_start_date")} />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Default Deposit Account</label>
                  <select
                    value={form.default_account_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, default_account_id: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">— None —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    Auto-fills the deposit account when logging a paycheck for this employer.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Any additional notes…"
                    value={form.notes}
                    onChange={field("notes")}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
                  />
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 text-[var(--color-danger)] text-sm bg-[var(--color-danger)]/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {editingId ? "Save Changes" : "Add Employer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
