"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Paycheck } from "@/lib/types";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GridPageSkeleton } from "@/components/ui/skeleton";

const FEDERAL_BRACKETS_SINGLE = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

const FEDERAL_BRACKETS_MFJ = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Infinity, rate: 0.37 },
];

const CA_BRACKETS_SINGLE = [
  { min: 0, max: 10756, rate: 0.01 },
  { min: 10756, max: 25499, rate: 0.02 },
  { min: 25499, max: 40245, rate: 0.04 },
  { min: 40245, max: 55866, rate: 0.06 },
  { min: 55866, max: 70606, rate: 0.08 },
  { min: 70606, max: 360659, rate: 0.093 },
  { min: 360659, max: 432787, rate: 0.103 },
  { min: 432787, max: 721314, rate: 0.113 },
  { min: 721314, max: Infinity, rate: 0.123 },
];

const FEDERAL_STANDARD_DEDUCTION_SINGLE = 15000;
const FEDERAL_STANDARD_DEDUCTION_MFJ = 30000;
const CA_SDI_RATE = 0.011;

const BRACKET_COLORS = [
  "bg-emerald-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-rose-600",
];

function calcTax(income: number, brackets: typeof FEDERAL_BRACKETS_SINGLE): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const taxable = Math.min(income, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }
  return tax;
}

type FilingStatus = "single" | "mfj";
type PayFrequency = 24 | 26 | 12;

interface TaxInputs {
  annualGross: number;
  filingStatus: FilingStatus;
  payFrequency: PayFrequency;
  contribution401kPct: number;
  otherPreTaxDeductions: number;
}

interface TaxResults {
  grossPay: number;
  contribution401k: number;
  otherPreTax: number;
  federalTaxableIncome: number;
  federalTax: number;
  stateTax: number;
  sdi: number;
  netPay: number;
  effectiveFederalRate: number;
  effectiveStateRate: number;
}

function calculateTaxes(inputs: TaxInputs): TaxResults {
  const { annualGross, filingStatus, contribution401kPct, otherPreTaxDeductions } = inputs;

  const contribution401k = annualGross * (contribution401kPct / 100);
  const otherPreTax = otherPreTaxDeductions;

  const standardDeduction =
    filingStatus === "mfj" ? FEDERAL_STANDARD_DEDUCTION_MFJ : FEDERAL_STANDARD_DEDUCTION_SINGLE;

  const federalTaxableIncome = Math.max(
    0,
    annualGross - contribution401k - otherPreTax - standardDeduction
  );

  const federalBrackets =
    filingStatus === "mfj" ? FEDERAL_BRACKETS_MFJ : FEDERAL_BRACKETS_SINGLE;

  const federalTax = calcTax(federalTaxableIncome, federalBrackets);
  const stateTax = calcTax(Math.max(0, annualGross - contribution401k - otherPreTax), CA_BRACKETS_SINGLE);
  const sdi = annualGross * CA_SDI_RATE;

  const netPay = annualGross - contribution401k - otherPreTax - federalTax - stateTax - sdi;

  const effectiveFederalRate = annualGross > 0 ? (federalTax / annualGross) * 100 : 0;
  const effectiveStateRate = annualGross > 0 ? (stateTax / annualGross) * 100 : 0;

  return {
    grossPay: annualGross,
    contribution401k,
    otherPreTax,
    federalTaxableIncome,
    federalTax,
    stateTax,
    sdi,
    netPay,
    effectiveFederalRate,
    effectiveStateRate,
  };
}

function fmt(n: number) {
  return formatCurrency(n);
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

export default function TaxEstimatorPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inputs, setInputs] = useState<TaxInputs>({
    annualGross: 0,
    filingStatus: "single",
    payFrequency: 26,
    contribution401kPct: 0,
    otherPreTaxDeductions: 0,
  });

  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function fetchPaychecks() {
      setIsLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("paychecks")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });

      if (err) {
        setError(err.message);
      } else if (data && data.length > 0) {
        setPaychecks(data as Paycheck[]);
        if (!prefilled) {
          const freq: PayFrequency = 26;
          const ytdGross = data.reduce((sum, p) => sum + p.gross_pay, 0);
          const ytdRetirement = data.reduce((sum, p) => sum + p.retirement_401k, 0);
          const count = data.length;
          const annualGross = count > 0 ? (ytdGross / count) * freq : 0;
          const contrib401kPct = ytdGross > 0 ? (ytdRetirement / ytdGross) * 100 : 0;

          setInputs((prev) => ({
            ...prev,
            annualGross: Math.round(annualGross),
            contribution401kPct: Math.round(contrib401kPct * 10) / 10,
            payFrequency: freq,
          }));
          setPrefilled(true);
        }
      }
      setIsLoading(false);
    }

    fetchPaychecks();
  }, [user]);

  const results = useMemo(() => calculateTaxes(inputs), [inputs]);

  const perPaycheck = (annual: number) =>
    inputs.payFrequency > 0 ? annual / inputs.payFrequency : 0;

  const ytdFederal = paychecks.reduce((sum, p) => sum + p.federal_tax, 0);
  const ytdState = paychecks.reduce((sum, p) => sum + p.state_tax, 0);
  const ytdSdi = paychecks.reduce((sum, p) => sum + p.sdi, 0);
  const ytdTotal = ytdFederal + ytdState + ytdSdi;
  const projectedTotal = results.federalTax + results.stateTax + results.sdi;

  const overUnder = ytdTotal > 0 ? projectedTotal - ytdTotal : null;

  const federalBrackets =
    inputs.filingStatus === "mfj" ? FEDERAL_BRACKETS_MFJ : FEDERAL_BRACKETS_SINGLE;

  function setField<K extends keyof TaxInputs>(key: K, value: TaxInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  const inputClass =
    "w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1";

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-sm">
        Please sign in to use the Tax Estimator.
      </div>
    );
  }

  if (isLoading) return <GridPageSkeleton cards={3} />;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Tax Estimator</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          2026 US Federal &amp; California State Tax — pre-filled from your YTD paycheck data
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          {paychecks.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Pre-filled from {paychecks.length} paychecks
            </span>
          )}
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Annual Gross Salary</label>
            <input
              type="number"
              className={inputClass}
              value={inputs.annualGross}
              onChange={(e) => setField("annualGross", Number(e.target.value))}
              min={0}
            />
          </div>

          <div>
            <label className={labelClass}>Filing Status</label>
            <select
              className={inputClass}
              value={inputs.filingStatus}
              onChange={(e) => setField("filingStatus", e.target.value as FilingStatus)}
            >
              <option value="single">Single</option>
              <option value="mfj">Married Filing Jointly</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Pay Frequency</label>
            <select
              className={inputClass}
              value={inputs.payFrequency}
              onChange={(e) => setField("payFrequency", Number(e.target.value) as PayFrequency)}
            >
              <option value={26}>Biweekly (26/yr)</option>
              <option value={24}>Semi-monthly (24/yr)</option>
              <option value={12}>Monthly (12/yr)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Pre-tax 401K Contribution (%)</label>
            <input
              type="number"
              className={inputClass}
              value={inputs.contribution401kPct}
              onChange={(e) => setField("contribution401kPct", Number(e.target.value))}
              min={0}
              max={100}
              step={0.1}
            />
          </div>

          <div>
            <label className={labelClass}>Other Pre-tax Deductions (annual)</label>
            <input
              type="number"
              className={inputClass}
              value={inputs.otherPreTaxDeductions}
              onChange={(e) => setField("otherPreTaxDeductions", Number(e.target.value))}
              min={0}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Federal Tax (Annual)</CardTitle>
          </CardHeader>
          <CardValue className="text-[var(--color-danger)]">{fmt(results.federalTax)}</CardValue>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>State Tax CA (Annual)</CardTitle>
          </CardHeader>
          <CardValue className="text-[var(--color-warning)]">{fmt(results.stateTax)}</CardValue>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Effective Federal Rate</CardTitle>
          </CardHeader>
          <CardValue className="text-[var(--color-text-primary)]">
            {pct(results.effectiveFederalRate)}
          </CardValue>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Effective State Rate</CardTitle>
          </CardHeader>
          <CardValue className="text-[var(--color-text-primary)]">
            {pct(results.effectiveStateRate)}
          </CardValue>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Breakdown</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-secondary)]">
                  Item
                </th>
                <th className="text-right py-2 pr-4 font-medium text-[var(--color-text-secondary)]">
                  Annual
                </th>
                <th className="text-right py-2 font-medium text-[var(--color-text-secondary)]">
                  Per Paycheck
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {[
                { label: "Gross Pay", value: results.grossPay, color: "text-[var(--color-text-primary)]" },
                { label: "401K Contribution", value: -results.contribution401k, color: "text-[var(--color-warning)]" },
                { label: "Other Pre-tax Deductions", value: -results.otherPreTax, color: "text-[var(--color-text-muted)]" },
                { label: "Taxable Income (Federal)", value: results.federalTaxableIncome, color: "text-[var(--color-text-secondary)]" },
                { label: "Federal Tax", value: -results.federalTax, color: "text-[var(--color-danger)]" },
                { label: "State Tax (CA)", value: -results.stateTax, color: "text-[var(--color-warning)]" },
                { label: "SDI (1.1%)", value: -results.sdi, color: "text-[var(--color-text-muted)]" },
                { label: "Net Pay", value: results.netPay, color: "text-[var(--color-success)]", bold: true },
              ].map((row) => (
                <tr key={row.label}>
                  <td className={`py-2.5 pr-4 ${row.bold ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                    {row.label}
                  </td>
                  <td className={`py-2.5 pr-4 text-right ${row.color} ${row.bold ? "font-semibold" : ""}`}>
                    {fmt(Math.abs(row.value))}
                    {row.value < 0 && row.label !== "Net Pay" ? (
                      <span className="text-[var(--color-text-muted)] ml-0.5 text-xs">&nbsp;↓</span>
                    ) : null}
                  </td>
                  <td className={`py-2.5 text-right ${row.color} ${row.bold ? "font-semibold" : ""}`}>
                    {fmt(Math.abs(perPaycheck(row.value)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Federal Tax Bracket Visualization</CardTitle>
          <span className="text-xs text-[var(--color-text-muted)]">
            Based on{" "}
            {inputs.filingStatus === "mfj" ? "Married Filing Jointly" : "Single"} filer
          </span>
        </CardHeader>
        <div className="space-y-3">
          {federalBrackets.map((bracket, i) => {
            const isInfinite = bracket.max === Infinity;
            const reached = results.federalTaxableIncome > bracket.min;
            const taxInBracket = reached
              ? (Math.min(results.federalTaxableIncome, isInfinite ? results.federalTaxableIncome : bracket.max) - bracket.min) *
                bracket.rate
              : 0;
            const bracketWidth = isInfinite ? 0 : bracket.max - bracket.min;
            const fillPct = isInfinite
              ? reached ? 100 : 0
              : bracketWidth > 0
              ? Math.min(
                  100,
                  (Math.max(0, results.federalTaxableIncome - bracket.min) / bracketWidth) * 100
                )
              : 0;

            return (
              <div key={i} className={`space-y-1 ${!reached ? "opacity-40" : ""}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">
                    {(bracket.rate * 100).toFixed(0)}% —{" "}
                    {isInfinite
                      ? `over ${fmt(bracket.min)}`
                      : `${fmt(bracket.min)} – ${fmt(bracket.max)}`}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {reached ? fmt(taxInBracket) : "—"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${BRACKET_COLORS[i] ?? "bg-gray-500"}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {paychecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>YTD vs Projected</CardTitle>
            <span className="text-xs text-[var(--color-text-muted)]">
              {paychecks.length} paychecks loaded
            </span>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1">
              <p className="text-xs text-[var(--color-text-secondary)]">YTD Federal Withheld</p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">{fmt(ytdFederal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--color-text-secondary)]">YTD State Withheld</p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">{fmt(ytdState)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--color-text-secondary)]">YTD SDI</p>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">{fmt(ytdSdi)}</p>
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Total YTD Withheld</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{fmt(ytdTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Projected Annual Total</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{fmt(projectedTotal)}</span>
            </div>
            {overUnder !== null && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5 border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                <span className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  {overUnder > 0 ? (
                    <TrendingUp className="h-4 w-4 text-[var(--color-danger)]" />
                  ) : overUnder < 0 ? (
                    <TrendingDown className="h-4 w-4 text-[var(--color-success)]" />
                  ) : (
                    <Minus className="h-4 w-4 text-[var(--color-text-muted)]" />
                  )}
                  {overUnder > 0
                    ? "Under-withheld — you may owe at filing"
                    : overUnder < 0
                    ? "Over-withheld — expect a refund"
                    : "On track"}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    overUnder > 0
                      ? "text-[var(--color-danger)]"
                      : overUnder < 0
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {overUnder > 0 ? "+" : ""}
                  {fmt(overUnder)}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
