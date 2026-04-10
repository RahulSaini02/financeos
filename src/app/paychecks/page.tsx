"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Paycheck, Employer } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Landmark,
  Briefcase,
} from "lucide-react";
import { TablePageSkeleton } from "@/components/ui/skeleton";

// ── Form types ────────────────────────────────────────────────────────────────

interface PaycheckFormData {
  date: string;
  employer: string;
  employer_id: string;
  gross_pay: string;
  federal_tax: string;
  state_tax: string;
  sdi: string;
  other_deductions: string;
  retirement_401k: string;
  net_pay: string;
  is_current_month: boolean;
  notes: string;
}

const emptyForm: PaycheckFormData = {
  date: "",
  employer: "",
  employer_id: "",
  gross_pay: "",
  federal_tax: "",
  state_tax: "",
  sdi: "",
  other_deductions: "",
  retirement_401k: "",
  net_pay: "",
  is_current_month: false,
  notes: "",
};

function calcNetPay(form: PaycheckFormData): number {
  const gross = parseFloat(form.gross_pay) || 0;
  const federal = parseFloat(form.federal_tax) || 0;
  const state = parseFloat(form.state_tax) || 0;
  const sdi = parseFloat(form.sdi) || 0;
  const other = parseFloat(form.other_deductions) || 0;
  const retirement = parseFloat(form.retirement_401k) || 0;
  return gross - federal - state - sdi - other - retirement;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface BarProps {
  label: string;
  value: number;
  gross: number;
  color: string;
}

function PayBar({ label, value, gross, color }: BarProps) {
  const pct = gross > 0 ? Math.min((value / gross) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-[var(--color-text-primary)] font-medium">
          {formatCurrency(value)} <span className="text-[var(--color-text-muted)]">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-bg-primary)]">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const inputClass =
  "w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaychecksPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PaycheckFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Employer management
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [addingEmployer, setAddingEmployer] = useState(false);
  const [newEmployerInput, setNewEmployerInput] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchPaychecks();
    fetchEmployers();
  }, [user]);

  async function fetchEmployers() {
    const { data } = await supabase
      .from("employers")
      .select("*")
      .eq("user_id", user!.id)
      .order("name");
    setEmployers(data ?? []);
  }

  async function fetchPaychecks() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("paychecks")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setPaychecks(data ?? []);
    }
    setLoading(false);
  }

  async function handleAddNewEmployer() {
    const name = newEmployerInput.trim();
    if (!name) return;
    const { data } = await supabase
      .from("employers")
      .insert({ user_id: user!.id, name })
      .select()
      .single();
    if (data) {
      setEmployers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, employer: data.name, employer_id: data.id }));
    }
    setNewEmployerInput("");
    setAddingEmployer(false);
  }

  function closeModal() {
    setShowModal(false);
    setForm(emptyForm);
    setSaveError(null);
    setAddingEmployer(false);
    setNewEmployerInput("");
  }

  function handleEmployerSelect(employerId: string) {
    if (employerId === "__add_new__") {
      setAddingEmployer(true);
      return;
    }
    const emp = employers.find((e) => e.id === employerId);
    if (emp) {
      setForm((prev) => ({ ...prev, employer: emp.name, employer_id: emp.id }));
    } else {
      setForm((prev) => ({ ...prev, employer: "", employer_id: "" }));
    }
    setAddingEmployer(false);
  }

  const yearPaychecks = useMemo(
    () => paychecks.filter((p) => new Date(p.date).getFullYear() === selectedYear),
    [paychecks, selectedYear]
  );

  const ytdGross = useMemo(() => yearPaychecks.reduce((s, p) => s + p.gross_pay, 0), [yearPaychecks]);
  const ytdNet = useMemo(() => yearPaychecks.reduce((s, p) => s + p.net_pay, 0), [yearPaychecks]);
  const ytdTaxes = useMemo(
    () => yearPaychecks.reduce((s, p) => s + p.federal_tax + p.state_tax + p.sdi, 0),
    [yearPaychecks]
  );
  const ytd401k = useMemo(
    () => yearPaychecks.reduce((s, p) => s + p.retirement_401k, 0),
    [yearPaychecks]
  );

  const currentPaycheck = useMemo(
    () => paychecks.find((p) => p.is_current_month) ?? null,
    [paychecks]
  );

  function handleFormChange(field: keyof PaycheckFormData, value: string | boolean) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      const net = calcNetPay(updated);
      return { ...updated, net_pay: net >= 0 ? net.toFixed(2) : "0.00" };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const payload = {
      user_id: user!.id,
      account_id: "",
      employer: form.employer || "Unknown",
      employer_id: form.employer_id || null,
      date: form.date,
      gross_pay: parseFloat(form.gross_pay) || 0,
      federal_tax: parseFloat(form.federal_tax) || 0,
      state_tax: parseFloat(form.state_tax) || 0,
      sdi: parseFloat(form.sdi) || 0,
      other_deductions: parseFloat(form.other_deductions) || 0,
      retirement_401k: parseFloat(form.retirement_401k) || 0,
      net_pay: parseFloat(form.net_pay) || 0,
      is_current_month: form.is_current_month,
      notes: form.notes || null,
    };

    const { error: err } = await supabase.from("paychecks").insert(payload);
    if (err) {
      setSaveError(err.message);
    } else {
      closeModal();
      await fetchPaychecks();
    }
    setSaving(false);
  }

  if (loading) return <TablePageSkeleton rows={5} />;

  if (error) {
    return (
      <div className="flex items-center gap-2 text-[var(--color-danger)] p-6">
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)]">Paychecks</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {paychecks[0]?.employer ?? "Income"} · Biweekly
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Paycheck
        </Button>
      </div>

      {/* Employers summary */}
      {employers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {employers.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-primary)]"
            >
              <span className="font-medium">{e.alias ?? e.name}</span>
              {e.grade && <span className="text-[var(--color-text-muted)]">· {e.grade}</span>}
            </span>
          ))}
          <a
            href="/employers"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
          >
            Manage employers →
          </a>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedYear((y) => y - 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-semibold text-[var(--color-text-primary)] w-12 text-center">
          {selectedYear}
        </span>
        <button
          onClick={() => setSelectedYear((y) => y + 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm text-[var(--color-text-muted)]">
          {yearPaychecks.length} paycheck{yearPaychecks.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>YTD Gross Pay</CardTitle>
            <DollarSign className="h-4 w-4 text-[var(--color-text-muted)]" />
          </CardHeader>
          <CardValue className="text-[var(--color-income)]">{formatCurrency(ytdGross)}</CardValue>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>YTD Net Pay</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--color-text-muted)]" />
          </CardHeader>
          <CardValue className="text-[var(--color-success)]">{formatCurrency(ytdNet)}</CardValue>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>YTD Taxes</CardTitle>
            <Landmark className="h-4 w-4 text-[var(--color-text-muted)]" />
          </CardHeader>
          <CardValue className="text-[var(--color-danger)]">{formatCurrency(ytdTaxes)}</CardValue>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>YTD 401K</CardTitle>
            <Briefcase className="h-4 w-4 text-[var(--color-text-muted)]" />
          </CardHeader>
          <CardValue className="text-[var(--color-accent)]">{formatCurrency(ytd401k)}</CardValue>
        </Card>
      </div>

      {currentPaycheck && (
        <Card className="border-[var(--color-accent)]/40 bg-[var(--color-bg-secondary)]">
          <CardHeader>
            <div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] mb-2 inline-block">
                Current Paycheck
              </span>
              <CardTitle className="text-[var(--color-text-primary)] text-base font-semibold mt-1">
                {new Date(currentPaycheck.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </CardTitle>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-muted)]">Net Pay</p>
              <p className="text-xl md:text-2xl font-semibold text-[var(--color-success)]">
                {formatCurrency(currentPaycheck.net_pay)}
              </p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <PayBar label="Net Pay" value={currentPaycheck.net_pay} gross={currentPaycheck.gross_pay} color="var(--color-success)" />
            <PayBar label="Federal Tax" value={currentPaycheck.federal_tax} gross={currentPaycheck.gross_pay} color="var(--color-danger)" />
            <PayBar label="State Tax" value={currentPaycheck.state_tax} gross={currentPaycheck.gross_pay} color="#f97316" />
            <PayBar label="SDI" value={currentPaycheck.sdi} gross={currentPaycheck.gross_pay} color="#eab308" />
            <PayBar label="401K" value={currentPaycheck.retirement_401k} gross={currentPaycheck.gross_pay} color="var(--color-accent)" />
            <PayBar label="Other Deductions" value={currentPaycheck.other_deductions} gross={currentPaycheck.gross_pay} color="var(--color-text-muted)" />
            <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Gross Pay</span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {formatCurrency(currentPaycheck.gross_pay)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {yearPaychecks.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="h-10 w-10 text-[var(--color-text-muted)] mb-3" />
            <p className="text-[var(--color-text-secondary)] font-medium">No paychecks for {selectedYear}</p>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Add a paycheck to get started.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
              Paycheck History · {selectedYear}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Date", "Employer", "Gross", "Federal Tax", "State Tax", "SDI", "401K", "Other", "Net Pay"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearPaychecks.map((p, i) => (
                  <tr
                    key={p.id}
                    className={
                      i % 2 === 0
                        ? "bg-transparent hover:bg-[var(--color-bg-tertiary)] transition-colors"
                        : "bg-[var(--color-bg-primary)]/40 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    }
                  >
                    <td className="px-4 py-3 text-[var(--color-text-primary)] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {p.is_current_month && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] inline-block flex-shrink-0" />
                        )}
                        {new Date(p.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{p.employer}</td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">{formatCurrency(p.gross_pay)}</td>
                    <td className="px-4 py-3 text-[var(--color-danger)]">{formatCurrency(p.federal_tax)}</td>
                    <td className="px-4 py-3 text-[var(--color-warning)]">{formatCurrency(p.state_tax)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatCurrency(p.sdi)}</td>
                    <td className="px-4 py-3 text-[var(--color-accent)]">{formatCurrency(p.retirement_401k)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatCurrency(p.other_deductions)}</td>
                    <td className="px-4 py-3 text-[var(--color-success)] font-medium">{formatCurrency(p.net_pay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                  <td className="px-4 py-3 text-xs font-medium text-[var(--color-text-muted)]">YTD Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-text-primary)]">{formatCurrency(ytdGross)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-danger)]">
                    {formatCurrency(yearPaychecks.reduce((s, p) => s + p.federal_tax, 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-warning)]">
                    {formatCurrency(yearPaychecks.reduce((s, p) => s + p.state_tax, 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {formatCurrency(yearPaychecks.reduce((s, p) => s + p.sdi, 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-accent)]">{formatCurrency(ytd401k)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
                    {formatCurrency(yearPaychecks.reduce((s, p) => s + p.other_deductions, 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-success)]">{formatCurrency(ytdNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Add Paycheck modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Add Paycheck</h2>
              <button
                onClick={closeModal}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">

                {/* Employer dropdown */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Employer
                  </label>
                  <select
                    value={addingEmployer ? "__add_new__" : (form.employer_id || "")}
                    onChange={(e) => handleEmployerSelect(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select employer…</option>
                    {employers.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.alias ? `${e.alias} — ${e.name}` : e.name}
                        {e.grade ? ` (${e.grade})` : ""}
                      </option>
                    ))}
                    <option value="__add_new__">＋ Add new employer</option>
                  </select>

                  {addingEmployer && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Employer name (quick add)"
                        value={newEmployerInput}
                        onChange={(e) => setNewEmployerInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddNewEmployer(); }}
                        autoFocus
                        className={inputClass}
                      />
                      <Button size="sm" onClick={handleAddNewEmployer} disabled={!newEmployerInput.trim()}>
                        Add
                      </Button>
                      <button
                        onClick={() => { setAddingEmployer(false); setNewEmployerInput(""); }}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors px-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {form.employer_id && !addingEmployer && (() => {
                    const emp = employers.find((e) => e.id === form.employer_id);
                    if (!emp) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                        {emp.location && <span>📍 {emp.location}</span>}
                        {emp.manager && <span>👤 {emp.manager}</span>}
                        {emp.ein && <span>EIN: {emp.ein}</span>}
                        {emp.my_start_date && <span>Since {new Date(emp.my_start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
                      </div>
                    );
                  })()}
                </div>

                {/* Pay Date */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Pay Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleFormChange("date", e.target.value)}
                    className={inputClass}
                  />
                </div>

                {(
                  [
                    { field: "gross_pay", label: "Gross Pay" },
                    { field: "federal_tax", label: "Federal Tax" },
                    { field: "state_tax", label: "State Tax" },
                    { field: "sdi", label: "SDI" },
                    { field: "retirement_401k", label: "401K" },
                    { field: "other_deductions", label: "Other Deductions" },
                  ] as { field: keyof PaycheckFormData; label: string }[]
                ).map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                      {label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form[field] as string}
                      onChange={(e) => handleFormChange(field, e.target.value)}
                      className={inputClass}
                    />
                  </div>
                ))}

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Net Pay (auto-calculated)
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={form.net_pay}
                    className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm text-[var(--color-success)] font-medium focus:outline-none cursor-not-allowed"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes..."
                    value={form.notes}
                    onChange={(e) => handleFormChange("notes", e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleFormChange("is_current_month", !form.is_current_month)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      form.is_current_month ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        form.is_current_month ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-[var(--color-text-secondary)]">Mark as current month</span>
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
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.date || !form.gross_pay}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save Paycheck
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
