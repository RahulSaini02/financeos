"use client";

import { useState, useEffect, use } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Loan, LoanPayment, Transaction } from "@/lib/types";
import {
  Landmark,
  TrendingDown,
  CalendarClock,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import Link from "next/link";

function monthsRemaining(balance: number, rate: number, emi: number): number {
  if (balance <= 0) return 0;
  const monthly = rate / 12;
  if (monthly === 0) return Math.ceil(balance / emi);
  return Math.ceil(Math.log(emi / (emi - balance * monthly)) / Math.log(1 + monthly));
}

function payoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface LoanWithDetails extends Loan {
  payments: LoanPayment[];
  transactions: Transaction[];
}

export default function LoanDetailPage({
  params,
}: {
  params: Promise<{ loan_id: string }>;
}) {
  const { loan_id } = use(params);
  const { user } = useAuth();
  const supabase = createClient();

  const [loan, setLoan] = useState<LoanWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  useEffect(() => {
    if (!user || !loan_id) return;
    fetchLoanDetails();
  }, [user, loan_id]);

  async function fetchLoanDetails() {
    setLoading(true);
    setError(null);

    const [
      { data: loanData, error: loanErr },
      { data: payments, error: paymentsErr },
      { data: transactions, error: transactionsErr },
    ] = await Promise.all([
      supabase
        .from("loans")
        .select("*")
        .eq("id", loan_id)
        .eq("user_id", user!.id)
        .single(),
      supabase
        .from("loan_payments")
        .select("*")
        .eq("loan_id", loan_id)
        .order("payment_date", { ascending: false }),
      supabase
        .from("transactions")
        .select("*, account:accounts(name)")
        .eq("user_id", user!.id)
        .eq("loan_id", loan_id)
        .order("date", { ascending: false }),
    ]);

    if (loanErr || !loanData) {
      setError("Loan not found");
      setLoading(false);
      return;
    }

    if (paymentsErr) console.error("Failed to fetch loan payments:", paymentsErr);
    if (transactionsErr) console.error("Failed to fetch loan transactions:", transactionsErr);

    setLoan({
      ...loanData,
      payments: payments ?? [],
      transactions: transactions ?? [],
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="p-6 flex items-center gap-2 text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" />
        <span>{error ?? "Loan not found"}</span>
      </div>
    );
  }

  const paidOff = loan.principal - loan.current_balance;
  const pctPaid = Math.min((paidOff / loan.principal) * 100, 100);
  const months = monthsRemaining(loan.current_balance, loan.interest_rate, loan.emi);
  const monthlyInterest = loan.interest_rate > 0
    ? loan.current_balance * (loan.interest_rate / 12)
    : 0;
  const totalPaid = loan.payments.reduce((s, p) => s + p.emi_paid, 0);
  const totalInterestPaid = loan.payments.reduce((s, p) => s + p.interest, 0);

  const visibleTransactions = showAllTransactions
    ? loan.transactions
    : loan.transactions.slice(0, 3);

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/loans"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Loans
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-danger)]/10">
          <Landmark className="h-6 w-6 text-[var(--color-danger)]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{loan.name}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] capitalize mt-0.5">
            {loan.type} loan
            {loan.interest_rate > 0
              ? ` · ${(loan.interest_rate * 100).toFixed(2)}% APR`
              : " · 0% interest"}
          </p>
        </div>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Original Amount</CardTitle>
          <CardValue className="mt-2">{formatCurrency(loan.principal)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Remaining Balance</CardTitle>
          <CardValue className="mt-2 text-[var(--color-danger)]">
            {formatCurrency(loan.current_balance)}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Monthly EMI</CardTitle>
          <CardValue className="mt-2">{formatCurrency(loan.emi)}</CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            ~{formatCurrency(monthlyInterest)} interest
          </p>
        </Card>
        <Card>
          <CardTitle>Payoff Date</CardTitle>
          <CardValue className="mt-2 text-sm font-semibold">
            {loan.current_balance > 0 ? payoffDate(months) : "Paid off"}
          </CardValue>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {months > 0 ? `${months} months remaining` : ""}
          </p>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Payoff Progress</h2>
          <span className="text-sm font-semibold text-[var(--color-success)]">
            {pctPaid.toFixed(1)}% paid
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-success)] transition-all"
            style={{ width: `${pctPaid}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-[var(--color-text-muted)]">
          <span>{formatCurrency(paidOff)} paid</span>
          <span>{formatCurrency(loan.current_balance)} remaining</span>
        </div>

        {/* Additional stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2 text-center">
            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Total Payments Made</p>
            <p className="font-semibold text-sm">{loan.payments.length}</p>
          </div>
          <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2 text-center">
            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Total Paid</p>
            <p className="font-semibold text-sm text-[var(--color-success)]">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2 text-center">
            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Interest Paid</p>
            <p className="font-semibold text-sm text-[var(--color-danger)]">{formatCurrency(totalInterestPaid)}</p>
          </div>
        </div>
      </Card>

      {/* Recent Transactions (Collapsed View) */}
      {loan.transactions.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
              Recent Activity
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {loan.transactions.length} transaction{loan.transactions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-2">
            {visibleTransactions.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      txn.cr_dr === "credit"
                        ? "bg-[var(--color-success)]/10"
                        : "bg-[var(--color-danger)]/10"
                    }`}
                  >
                    {txn.cr_dr === "credit" ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 text-[var(--color-success)]" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate max-w-48">
                      {txn.description}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {new Date(txn.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    txn.cr_dr === "credit"
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-danger)]"
                  }`}
                >
                  {txn.cr_dr === "credit" ? "+" : "-"}
                  {formatCurrency(Math.abs(txn.amount_usd))}
                </span>
              </div>
            ))}
          </div>

          {loan.transactions.length > 3 && (
            <button
              onClick={() => setShowAllTransactions((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
            >
              {showAllTransactions ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Show all {loan.transactions.length} transactions
                </>
              )}
            </button>
          )}
        </Card>
      )}

      {/* Full Payment Logs */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Payment History</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {loan.payments.length} payment{loan.payments.length !== 1 ? "s" : ""} recorded
          </p>
        </div>

        {loan.payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingDown className="h-8 w-8 text-[var(--color-text-muted)] mb-2" />
            <p className="text-sm text-[var(--color-text-secondary)]">No payments logged yet</p>
            <Link
              href="/loans"
              className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
            >
              Log a payment →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                  {["Date", "EMI", "Principal", "Interest", "Balance"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {loan.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--color-bg-tertiary)] transition-colors">
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {new Date(p.payment_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(p.emi_paid)}</td>
                    <td className="px-4 py-3 text-[var(--color-success)]">
                      {formatCurrency(p.principal_paid)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-danger)]">
                      {formatCurrency(p.interest)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {formatCurrency(p.closing_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                  <td className="px-4 py-3 text-xs font-medium text-[var(--color-text-muted)]">
                    Total
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">{formatCurrency(totalPaid)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-success)]">
                    {formatCurrency(loan.payments.reduce((s, p) => s + p.principal_paid, 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--color-danger)]">
                    {formatCurrency(totalInterestPaid)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Loan Info */}
      <Card>
        <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Loan Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Start Date", value: new Date(loan.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
            { label: "Term", value: `${loan.term_months} months` },
            { label: "Interest Rate", value: loan.interest_rate > 0 ? `${(loan.interest_rate * 100).toFixed(2)}% APR` : "0% (interest-free)" },
            { label: "Loan Type", value: loan.type.charAt(0).toUpperCase() + loan.type.slice(1) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{label}</p>
              <p className="font-medium capitalize">{value}</p>
            </div>
          ))}
        </div>
        {loan.notes && (
          <p className="mt-3 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
            {loan.notes}
          </p>
        )}
      </Card>

      {/* Back to Loans */}
      <div className="flex justify-start pb-4">
        <Button variant="secondary" onClick={() => window.history.back()}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to All Loans
        </Button>
      </div>
    </div>
  );
}
