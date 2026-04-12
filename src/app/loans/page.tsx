"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Loan, LoanPayment, Account } from "@/lib/types";
import {
  Landmark,
  TrendingDown,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Calculator,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";

// ── helpers ──────────────────────────────────────────────────────────────────

function monthsRemaining ( balance: number, rate: number, emi: number ): number {
  if ( balance <= 0 ) return 0;
  const monthly = rate / 12;
  if ( monthly === 0 ) return Math.ceil( balance / emi );
  // standard amortization formula
  return Math.ceil(
    Math.log( emi / ( emi - balance * monthly ) ) / Math.log( 1 + monthly )
  );
}

function payoffDate ( months: number ): string {
  const d = new Date();
  d.setMonth( d.getMonth() + months );
  return d.toLocaleDateString( "en-US", { month: "short", year: "numeric" } );
}

function totalInterestRemaining (
  balance: number,
  rate: number,
  emi: number,
  months: number
): number {
  return Math.max( 0, emi * months - balance );
}

function simulateExtraPayment (
  balance: number,
  rate: number,
  emi: number,
  extra: number
): { months: number; interestSaved: number } {
  const baseMonths = monthsRemaining( balance, rate, emi );
  const newMonths = monthsRemaining( balance, rate, emi + extra );
  const baseInterest = totalInterestRemaining( balance, rate, emi, baseMonths );
  const newInterest = totalInterestRemaining(
    balance,
    rate,
    emi + extra,
    newMonths
  );
  return {
    months: baseMonths - newMonths,
    interestSaved: baseInterest - newInterest,
  };
}

// ── component ─────────────────────────────────────────────────────────────────

interface LoanWithPayments extends Loan {
  payments: LoanPayment[];
}

export default function LoansPage () {
  const { user } = useAuth();
  const supabase = createClient();

  const [loans, setLoans] = useState<LoanWithPayments[]>( [] );
  const [accounts, setAccounts] = useState<Account[]>( [] );
  const [isLoading, setIsLoading] = useState( true );
  const [error, setError] = useState<string | null>( null );
  const [expandedId, setExpandedId] = useState<string | null>( null );
  const [extraPayments, setExtraPayments] = useState<Record<string, string>>( {} );
  const [logPaymentLoan, setLogPaymentLoan] = useState<LoanWithPayments | null>( null );

  const fetchLoans = useCallback( async () => {
    if ( !user ) return;
    setIsLoading( true );
    setError( null );

    const [{ data: loanData, error: loanErr }, { data: acctData }] = await Promise.all( [
      supabase
        .from( "loans" )
        .select( "*" )
        .eq( "user_id", user.id )
        .order( "current_balance", { ascending: false } ),
      supabase
        .from( "accounts" )
        .select( "*" )
        .eq( "user_id", user.id )
        .eq( "is_active", true )
        .eq( "kind", "asset" )
        .order( "name" ),
    ] );

    setAccounts( acctData ?? [] );

    if ( loanErr ) {
      setError( "Failed to load loans" );
      setIsLoading( false );
      return;
    }

    const loansWithPayments: LoanWithPayments[] = await Promise.all(
      ( loanData ?? [] ).map( async ( loan ) => {
        const { data: payments } = await supabase
          .from( "loan_payments" )
          .select( "*" )
          .eq( "loan_id", loan.id )
          .order( "payment_date", { ascending: false } );
        return { ...loan, payments: payments ?? [] };
      } )
    );

    setLoans( loansWithPayments );
    setIsLoading( false );
  }, [user, supabase] );

  useEffect( () => { fetchLoans(); }, [fetchLoans] );

  const totals = useMemo( () => {
    const totalDebt = loans.reduce( ( s, l ) => s + l.current_balance, 0 );
    const totalEMI = loans.reduce( ( s, l ) => s + l.emi, 0 );
    const totalPrincipal = loans.reduce( ( s, l ) => s + l.principal, 0 );
    const totalPaid = totalPrincipal - totalDebt;
    return { totalDebt, totalEMI, totalPrincipal, totalPaid };
  }, [loans] );

  if ( isLoading ) return <GridPageSkeleton cards={3} />;

  if ( error ) {
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
        title="Loans & Debt"
        subtitle="Track payoff progress and simulate extra payments"
        tooltip={
          <HelpModal
            title="Loans"
            description="Track all your loans — student, personal, auto, mortgage, and more. See balances, EMIs, interest rates, and total repayment progress at a glance."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Add each loan with its principal, interest rate, and term",
                  "Log payments to reduce the outstanding balance",
                  "Click 'Details' on any loan to see the full payment history and amortization",
                  "The progress bar shows how much of the principal has been paid off",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add Loan — record a new loan with its terms",
                  "Log Payment — record a payment and reduce the balance",
                  "Details — drill into payment history for a specific loan",
                ],
              },
            ]}
          />
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Total Debt</CardTitle>
          <CardValue className="mt-2 text-[var(--color-danger)]">
            {formatCurrency( totals.totalDebt )}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Monthly EMI</CardTitle>
          <CardValue className="mt-2">{formatCurrency( totals.totalEMI )}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total Principal</CardTitle>
          <CardValue className="mt-2">{formatCurrency( totals.totalPrincipal )}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total Paid</CardTitle>
          <CardValue className="mt-2 text-[var(--color-success)]">
            {formatCurrency( totals.totalPaid )}
          </CardValue>
        </Card>
      </div>

      {/* Loan cards */}
      {loans.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-8 w-8" />}
          title="No loans found"
          description="Add a loan to track payoff progress and simulate extra payments."
        />
      ) : (
        <div className="space-y-4">
          {loans.map( ( loan ) => {
            const paidOff = loan.principal - loan.current_balance;
            const pctPaid = ( paidOff / loan.principal ) * 100;
            const months = monthsRemaining(
              loan.current_balance,
              loan.interest_rate,
              loan.emi
            );
            const payoff = payoffDate( months );
            const extraVal = parseFloat( extraPayments[loan.id] ?? "0" ) || 0;
            const sim = simulateExtraPayment(
              loan.current_balance,
              loan.interest_rate,
              loan.emi,
              extraVal
            );
            const isExpanded = expandedId === loan.id;
            const monthlyInterest =
              loan.interest_rate > 0
                ? loan.current_balance * ( loan.interest_rate / 12 )
                : 0;

            return (
              <Card key={loan.id}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-danger)]/10">
                      <Landmark className="h-5 w-5 text-[var(--color-danger)]" />
                    </div>
                    <div>
                      <p className="font-semibold">{loan.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)] capitalize">
                        {loan.type} loan ·{" "}
                        {loan.interest_rate > 0
                          ? `${ ( loan.interest_rate * 100 ).toFixed( 2 ) }% APR`
                          : "0% interest"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-[var(--color-danger)]">
                      {formatCurrency( loan.current_balance )}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      remaining
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span>{pctPaid.toFixed( 1 )}% paid off</span>
                    <span>{formatCurrency( paidOff )} of {formatCurrency( loan.principal )}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-success)] transition-all"
                      style={{ width: `${ Math.min( pctPaid, 100 ) }%` }}
                    />
                  </div>
                </div>

                {/* Key stats row */}
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                      Monthly EMI
                    </p>
                    <p className="font-medium">{formatCurrency( loan.emi )}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                      Payoff Date
                    </p>
                    <p className="font-medium">{payoff}</p>
                  </div>
                  <div className="rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                      Monthly Interest
                    </p>
                    <p className="font-medium text-[var(--color-danger)]">
                      {formatCurrency( monthlyInterest )}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => setLogPaymentLoan( loan )}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" /> Log Payment
                  </button>
                  <Link
                    href={`/loans/${ loan.id }`}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Details
                  </Link>
                  <button
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    onClick={() => setExpandedId( isExpanded ? null : loan.id )}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? "Hide details" : "Show details"}
                  </button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-5">
                    {/* Extra payment simulator */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="h-4 w-4 text-[var(--color-accent)]" />
                        <p className="text-sm font-medium">
                          Extra Payment Simulator
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">
                            +$
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            placeholder="0"
                            className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] pl-7 pr-3 text-sm"
                            value={extraPayments[loan.id] ?? ""}
                            onChange={( e ) =>
                              setExtraPayments( ( p ) => ( {
                                ...p,
                                [loan.id]: e.target.value,
                              } ) )
                            }
                          />
                        </div>
                        <span className="text-sm text-[var(--color-text-muted)]">
                          extra / month
                        </span>
                      </div>
                      {extraVal > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-3 py-2">
                            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                              Months saved
                            </p>
                            <p className="font-semibold text-[var(--color-success)]">
                              {sim.months > 0 ? `${ sim.months } months` : "< 1 month"}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              Payoff by {payoffDate( months - sim.months )}
                            </p>
                          </div>
                          <div className="rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-3 py-2">
                            <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                              Interest saved
                            </p>
                            <p className="font-semibold text-[var(--color-success)]">
                              {formatCurrency( sim.interestSaved )}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              Over loan lifetime
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment history */}
                    {loan.payments.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium">Payment History</p>
                          <button
                            onClick={() => setLogPaymentLoan( loan )}
                            className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Log payment
                          </button>
                        </div>
                        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-[var(--color-bg-tertiary)]">
                              <tr>
                                <th className="text-left px-3 py-2 text-[var(--color-text-muted)] font-medium">
                                  Date
                                </th>
                                <th className="text-right px-3 py-2 text-[var(--color-text-muted)] font-medium">
                                  EMI
                                </th>
                                <th className="text-right px-3 py-2 text-[var(--color-text-muted)] font-medium">
                                  Principal
                                </th>
                                <th className="text-right px-3 py-2 text-[var(--color-text-muted)] font-medium">
                                  Interest
                                </th>
                                <th className="text-right px-3 py-2 text-[var(--color-text-muted)] font-medium">
                                  Balance
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                              {loan.payments.slice( 0, 6 ).map( ( p ) => (
                                <tr
                                  key={p.id}
                                  className="hover:bg-[var(--color-bg-tertiary)]"
                                >
                                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                                    {new Date( p.payment_date ).toLocaleDateString(
                                      "en-US",
                                      { month: "short", year: "numeric" }
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {formatCurrency( p.emi_paid )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[var(--color-success)]">
                                    {formatCurrency( p.principal_paid )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[var(--color-danger)]">
                                    {formatCurrency( p.interest )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">
                                    {formatCurrency( p.closing_balance )}
                                  </td>
                                </tr>
                              ) )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {loan.payments.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-xs text-[var(--color-text-muted)] mb-2">
                          No payment history recorded yet
                        </p>
                        <button
                          onClick={() => setLogPaymentLoan( loan )}
                          className="flex items-center gap-1.5 mx-auto text-xs text-[var(--color-accent)] hover:underline"
                        >
                          <Plus className="h-3 w-3" /> Log first payment
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          } )}
        </div>
      )}

      {/* Log Payment Modal */}
      {logPaymentLoan && (
        <LogPaymentModal
          loan={logPaymentLoan}
          accounts={accounts}
          onClose={() => setLogPaymentLoan( null )}
          onSaved={() => { setLogPaymentLoan( null ); fetchLoans(); }}
        />
      )}
    </div>
  );
}

// ── Log Payment Modal ─────────────────────────────────────────────────────────

function LogPaymentModal ( {
  loan,
  accounts,
  onClose,
  onSaved,
}: {
  loan: LoanWithPayments;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
} ) {

  /*Key insight( important )
Your lender is NOT doing:
  Interest=Current Balance × 𝑟 / 12

They are doing: 👉 Daily interest accrual on declining balance

  Interest = ∑(Daily Balance × 𝑟 / 365 )

But because balance changes only monthly( no mid - cycle transactions ), it looks like monthly compounding.
*/
  // const days =
  //   ( new Date( currentDate ).getTime() -
  //     new Date( previousDate ).getTime() ) /
  //   ( 1000 * 60 * 60 * 24 );

  const monthlyInterest = loan.interest_rate > 0
    ? parseFloat( ( loan.current_balance * ( loan.interest_rate / 365 ) ).toFixed( 2 ) )
    : 0;
  const defaultPrincipal = parseFloat( Math.max( loan.emi - monthlyInterest, 0 ).toFixed( 2 ) );
  const defaultClosing = parseFloat( Math.max( loan.current_balance - defaultPrincipal, 0 ).toFixed( 2 ) );

  const [paymentDate, setPaymentDate] = useState( new Date().toISOString().split( "T" )[0] );
  const [emiPaid, setEmiPaid] = useState( loan.emi.toString() );
  const [interest, setInterest] = useState( monthlyInterest.toString() );
  const [principalPaid, setPrincipalPaid] = useState( defaultPrincipal.toString() );
  const [closingBalance, setClosingBalance] = useState( defaultClosing.toString() );
  const [fromAccountId, setFromAccountId] = useState( accounts[0]?.id ?? "" );
  const [saving, setSaving] = useState( false );
  const [saveError, setSaveError] = useState<string | null>( null );

  // Recalculate principal & closing when EMI or interest changes
  function handleEmiChange ( val: string ) {
    setEmiPaid( val );
    const emi = parseFloat( val ) || 0;
    const int = parseFloat( interest ) || 0;
    const principal = Math.max( emi - int, 0 );
    setPrincipalPaid( principal.toFixed( 2 ) );
    setClosingBalance( Math.max( loan.current_balance - principal, 0 ).toFixed( 2 ) );
  }

  function handleInterestChange ( val: string ) {
    setInterest( val );
    const emi = parseFloat( emiPaid ) || 0;
    const int = parseFloat( val ) || 0;
    const principal = Math.max( emi - int, 0 );
    setPrincipalPaid( principal.toFixed( 2 ) );
    setClosingBalance( Math.max( loan.current_balance - principal, 0 ).toFixed( 2 ) );
  }

  async function handleSave () {
    setSaving( true );
    setSaveError( null );
    try {
      const res = await fetch( "/api/loans/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify( {
          loan_id: loan.id,
          payment_date: paymentDate,
          emi_paid: parseFloat( emiPaid ),
          interest: parseFloat( interest ),
          principal_paid: parseFloat( principalPaid ),
          closing_balance: parseFloat( closingBalance ),
          from_account_id: fromAccountId || null,
        } ),
      } );
      const json = await res.json();
      if ( !res.ok ) throw new Error( json.error ?? "Failed to save" );
      onSaved();
    } catch ( e ) {
      setSaveError( e instanceof Error ? e.message : "Failed to save" );
    } finally {
      setSaving( false );
    }
  }

  const inputClass = "w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)]  mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Log Payment</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{loan.name} · Balance: {formatCurrency( loan.current_balance )}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {accounts.length > 0 && (
            <div>
              <label className={labelClass}>Pay From Account</label>
              <select
                className={inputClass}
                value={fromAccountId}
                onChange={e => setFromAccountId( e.target.value )}
              >
                <option value="">— skip (no transaction created) —</option>
                {accounts.map( a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatCurrency( a.current_balance ?? 0 )})
                  </option>
                ) )}
              </select>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                A debit transaction will be auto-created in your ledger.
              </p>
            </div>
          )}
          <div>
            <label className={labelClass}>Payment Date</label>
            <input type="date" className={inputClass} value={paymentDate} onChange={e => setPaymentDate( e.target.value )} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>EMI Paid ($)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={emiPaid} onChange={e => handleEmiChange( e.target.value )} />
            </div>
            <div>
              <label className={labelClass}>Interest ($)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={interest} onChange={e => handleInterestChange( e.target.value )} />
            </div>
            <div>
              <label className={labelClass}>Principal Paid ($)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={principalPaid} onChange={e => setPrincipalPaid( e.target.value )} readOnly />
            </div>
            <div>
              <label className={labelClass}>Closing Balance ($)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={closingBalance} onChange={e => setClosingBalance( e.target.value )} readOnly />
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-[var(--color-danger)] text-sm bg-[var(--color-danger)]/10 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !paymentDate || !emiPaid}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Log Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
