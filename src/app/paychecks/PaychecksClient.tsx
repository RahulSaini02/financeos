"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import type { Paycheck, Employer, Account } from "@/lib/types";
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
  Pencil,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ── Form types ────────────────────────────────────────────────────────────────

interface PaycheckFormData {
  date: string;
  employer: string;
  employer_id: string;
  account_id: string;
  gross_pay: string;
  federal_tax: string;
  state_tax: string;
  sdi: string;
  other_deductions: string;
  retirement_401k: string;
  employee_401k_pct: string;
  net_pay: string;
  notes: string;
}

const emptyForm: PaycheckFormData = {
  date: "",
  employer: "",
  employer_id: "",
  account_id: "",
  gross_pay: "",
  federal_tax: "",
  state_tax: "",
  sdi: "",
  other_deductions: "",
  retirement_401k: "",
  employee_401k_pct: "3",
  net_pay: "",
  notes: "",
};

// Employer match: 100% on first 3%, 50% on remainder
function calcEmployerMatch(gross: number, employeePct: number): number {
  const base = Math.min(employeePct, 3);
  const extra = Math.max(employeePct - 3, 0);
  return gross * (base / 100) + gross * (extra / 100) * 0.5;
}

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
  "w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

// ── Main client component ─────────────────────────────────────────────────────

interface PaychecksClientProps {
  initialPaychecks: Paycheck[];
  employers: Employer[];
}

export function PaychecksClient({ initialPaychecks, employers: initialEmployers }: PaychecksClientProps) {
  const supabase = createClient();

  const [paychecks, setPaychecks] = useState<Paycheck[]>(initialPaychecks);
  const [error, setError] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<PaycheckFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Employer management
  const [employers, setEmployers] = useState<Employer[]>(initialEmployers as Employer[]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [addingEmployer, setAddingEmployer] = useState(false);
  const [newEmployerInput, setNewEmployerInput] = useState("");

  async function loadAccounts() {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .in("type", ["checking", "savings"])
      .order("name");
    setAccounts((data as Account[]) ?? []);
  }

  async function fetchPaychecks() {
    setError(null);
    const { data, error: err } = await supabase
      .from("paychecks")
      .select("*")
      .order("date", { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setPaychecks(data ?? []);
    }
  }

  async function handleAddNewEmployer() {
    const name = newEmployerInput.trim();
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("employers")
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (data) {
      setEmployers((prev) => [...prev, data as Employer].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, employer: data.name, employer_id: data.id }));
    }
    setNewEmployerInput("");
    setAddingEmployer(false);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setSaveError(null);
    setAddingEmployer(false);
    setNewEmployerInput("");
  }

  function openAdd() {
    loadAccounts();
    setShowModal(true);
  }

  function openEdit(p: Paycheck) {
    loadAccounts();
    setEditingId(p.id);
    const empPct = p.employee_401k_pct > 0
      ? String(p.employee_401k_pct)
      : (p.gross_pay > 0 ? ((p.retirement_401k / p.gross_pay) * 100).toFixed(2) : "3");
    setForm({
      date: p.date,
      employer: p.employer,
      employer_id: p.employer_id ?? "",
      account_id: p.account_id,
      gross_pay: String(p.gross_pay),
      federal_tax: String(p.federal_tax),
      state_tax: String(p.state_tax),
      sdi: String(p.sdi),
      other_deductions: String(p.other_deductions),
      retirement_401k: String(p.retirement_401k),
      employee_401k_pct: empPct,
      net_pay: String(p.net_pay),
      notes: p.notes ?? "",
    });
    setSaveError(null);
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const paycheck = paychecks.find((p) => p.id === id);
    if (paycheck?.transaction_id) {
      await supabase.from("transactions").delete().eq("id", paycheck.transaction_id);
    }
    const { error: err } = await supabase
      .from("paychecks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (!err) {
      setPaychecks((prev) => prev.filter((p) => p.id !== id));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  function handleEmployerSelect(employerId: string) {
    if (employerId === "__add_new__") {
      setAddingEmployer(true);
      return;
    }
    const emp = employers.find((e) => e.id === employerId);
    if (emp) {
      setForm((prev) => ({
        ...prev,
        employer: emp.name,
        employer_id: emp.id,
        account_id: emp.default_account_id ?? prev.account_id,
      }));
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
  const ytdEmployerMatch = useMemo(
    () => yearPaychecks.reduce((s, p) => s + (p.employer_401k_match ?? 0), 0),
    [yearPaychecks]
  );

  function handleFormChange(field: keyof PaycheckFormData, value: string | boolean) {
    setForm((prev) => {
      let updated = { ...prev, [field]: value };

      if (field === "employee_401k_pct" || field === "gross_pay") {
        const gross = parseFloat(field === "gross_pay" ? String(value) : updated.gross_pay) || 0;
        const pct = parseFloat(field === "employee_401k_pct" ? String(value) : updated.employee_401k_pct) || 0;
        const dollar = (gross * pct) / 100;
        updated = { ...updated, retirement_401k: dollar > 0 ? dollar.toFixed(2) : "" };
      }

      const net = calcNetPay(updated);
      return { ...updated, net_pay: net >= 0 ? net.toFixed(2) : "0.00" };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const netPay = parseFloat(form.net_pay) || 0;
    const gross = parseFloat(form.gross_pay) || 0;
    const employee401k = parseFloat(form.retirement_401k) || 0;
    const employee401kPct = parseFloat(form.employee_401k_pct) || 0;
    const employerMatch = calcEmployerMatch(gross, employee401kPct);

    const payload = {
      user_id: user.id,
      account_id: form.account_id || "",
      employer: form.employer || "Unknown",
      employer_id: form.employer_id || null,
      date: form.date,
      gross_pay: gross,
      federal_tax: parseFloat(form.federal_tax) || 0,
      state_tax: parseFloat(form.state_tax) || 0,
      sdi: parseFloat(form.sdi) || 0,
      other_deductions: parseFloat(form.other_deductions) || 0,
      retirement_401k: employee401k,
      employee_401k_pct: employee401kPct,
      employer_401k_match: employerMatch,
      net_pay: netPay,
      notes: form.notes || null,
    };

    // ── Edit path ──────────────────────────────────────────────────────────────
    if (editingId) {
      const { error: updateErr } = await supabase
        .from("paychecks")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (updateErr) {
        setSaveError(updateErr.message);
        setSaving(false);
        return;
      }

      const existing = paychecks.find((p) => p.id === editingId);
      if (existing?.transaction_id) {
        await supabase
          .from("transactions")
          .update({
            account_id: payload.account_id || existing.account_id,
            description: `Paycheck — ${payload.employer || "Employer"}`,
            amount_usd: netPay,
            date: payload.date,
          })
          .eq("id", existing.transaction_id);
      }

      closeModal();
      await fetchPaychecks();
      setSaving(false);
      return;
    }

    // ── Insert path ────────────────────────────────────────────────────────────
    const { data: paycheck, error: err } = await supabase
      .from("paychecks")
      .insert(payload)
      .select()
      .single();

    if (err || !paycheck) {
      setSaveError(err?.message ?? "Failed to save paycheck");
      setSaving(false);
      return;
    }

    if (form.account_id && netPay > 0) {
      const txnRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: form.account_id,
          description: `Paycheck — ${form.employer || "Employer"}`,
          amount_usd: netPay,
          cr_dr: "credit",
          date: form.date,
          notes: `Auto-generated from paycheck. Gross: $${form.gross_pay}`,
        }),
      });

      if (txnRes.ok) {
        const txn = await txnRes.json();
        await supabase
          .from("paychecks")
          .update({ transaction_id: txn.id })
          .eq("id", paycheck.id);
      } else {
        let errMsg = "Income transaction could not be created";
        try {
          const body = await txnRes.json();
          if (body?.error) errMsg = `Paycheck saved, but transaction failed: ${body.error}`;
        } catch { /* ignore */ }
        setSaveError(errMsg);
        setSaving(false);
        await fetchPaychecks();
        return;
      }
    }

    // ── Sync 401K investment ──────────────────────────────────────────────────
    const total401k = employee401k + employerMatch;
    if (total401k > 0) {
      try {
        const { data: investments } = await supabase
          .from("investments")
          .select("id, total_invested, current_value")
          .eq("user_id", user.id)
          .ilike("type", "%401%")
          .order("created_at", { ascending: true })
          .limit(1);

        if (investments && investments.length > 0) {
          const inv = investments[0];
          await supabase
            .from("investments")
            .update({
              total_invested: (inv.total_invested ?? 0) + total401k,
              current_value: (inv.current_value ?? 0) + total401k,
            })
            .eq("id", inv.id);
        }
      } catch { /* non-fatal */ }
    }

    closeModal();
    await fetchPaychecks();
    setSaving(false);
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
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Paychecks"
        subtitle={`${paychecks[0]?.employer ?? "Income"} · Biweekly`}
        tooltip={
          <HelpModal
            title="Paychecks"
            description="Log every paycheck with full breakdown — gross pay, federal and state taxes, Social Security, Medicare, 401k, and net pay. Automatically creates an income transaction on save."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Log each paycheck right after it arrives in your account",
                  "Select your employer to auto-fill the linked deposit account",
                  "Enter gross pay and all deductions — net pay is calculated automatically",
                  "A linked income transaction is auto-created so Transactions stays in sync",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add Paycheck — record a new pay stub",
                  "Edit — correct any amounts on a previously logged paycheck",
                  "View linked transaction — navigate to the auto-created income entry",
                ],
              },
            ]}
          />
        }
      >
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Paycheck
        </Button>
      </PageHeader>

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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
          <CardValue className="text-[var(--color-accent)]">{formatCurrency(ytd401k + ytdEmployerMatch)}</CardValue>
          {ytdEmployerMatch > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              +{formatCurrency(ytdEmployerMatch)} employer match
            </p>
          )}
        </Card>
      </div>

      {yearPaychecks.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-8 w-8" />}
          title={`No paychecks for ${selectedYear}`}
          description="Add a paycheck to get started."
          action={{ label: "Add Paycheck", onClick: openAdd }}
        />
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
                  {["Date", "Employer", "Gross", "Federal Tax", "State Tax", "SDI", "401K (Emp+Match)", "Other", "Net Pay", ""].map((h) => (
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
                      {new Date(p.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{p.employer}</td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">{formatCurrency(p.gross_pay)}</td>
                    <td className="px-4 py-3 text-[var(--color-danger)]">{formatCurrency(p.federal_tax)}</td>
                    <td className="px-4 py-3 text-[var(--color-warning)]">{formatCurrency(p.state_tax)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatCurrency(p.sdi)}</td>
                    <td className="px-4 py-3 text-[var(--color-accent)]">
                      {formatCurrency(p.retirement_401k + (p.employer_401k_match ?? 0))}
                      {(p.employer_401k_match ?? 0) > 0 && (
                        <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                          (+{formatCurrency(p.employer_401k_match ?? 0)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatCurrency(p.other_deductions)}</td>
                    <td className="px-4 py-3 text-[var(--color-success)] font-medium">{formatCurrency(p.net_pay)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                          aria-label="Edit paycheck"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          disabled={deletingId === p.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
                          aria-label="Delete paycheck"
                        >
                          {deletingId === p.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
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
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-accent)]">{formatCurrency(ytd401k + ytdEmployerMatch)}</td>
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
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{editingId ? "Edit Paycheck" : "Add Paycheck"}</h2>
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

                {/* Deposit Account */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Deposit Account
                  </label>
                  <select
                    value={form.account_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, account_id: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">— Select account (optional) —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {form.account_id && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      An income transaction will be auto-created in this account.
                    </p>
                  )}
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
                    className={`${inputClass}`}
                  />
                </div>

                {(
                  [
                    { field: "gross_pay", label: "Gross Pay" },
                    { field: "federal_tax", label: "Federal Tax" },
                    { field: "state_tax", label: "State Tax" },
                    { field: "sdi", label: "SDI" },
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

                {/* 401K section */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    401K Employee Contribution (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="3"
                    value={form.employee_401k_pct}
                    onChange={(e) => handleFormChange("employee_401k_pct", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    401K Employee Amount (auto)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.retirement_401k}
                    onChange={(e) => handleFormChange("retirement_401k", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2">
                  {(() => {
                    const gross = parseFloat(form.gross_pay) || 0;
                    const pct = parseFloat(form.employee_401k_pct) || 0;
                    const match = calcEmployerMatch(gross, pct);
                    const total = (parseFloat(form.retirement_401k) || 0) + match;
                    return gross > 0 ? (
                      <div className="rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] px-3 py-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-muted)]">Employer match (100% of first 3%, 50% above)</span>
                          <span className="font-medium text-[var(--color-accent)]">+{formatCurrency(match)}</span>
                        </div>
                        <div className="flex justify-between border-t border-[var(--color-border)] pt-1">
                          <span className="text-[var(--color-text-secondary)] font-medium">Total 401K (employee + employer)</span>
                          <span className="font-semibold text-[var(--color-success)]">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

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
                {editingId ? "Save Changes" : "Save Paycheck"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        title="Delete this paycheck?"
        description="This will also delete the linked income transaction. This action cannot be undone."
        confirmLabel="Delete"
        loading={!!deletingId}
      />
    </div>
  );
}
