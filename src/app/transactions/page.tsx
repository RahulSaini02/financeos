"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Transaction, Account, Category, Loan } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search,
  Filter,
  Plus,
  X,
  AlertTriangle,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TablePageSkeleton } from "@/components/ui/skeleton";

interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

function TransactionsContent () {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>( [] );
  const [accounts, setAccounts] = useState<Account[]>( [] );
  const [categories, setCategories] = useState<Category[]>( [] );
  const [loans, setLoans] = useState<Loan[]>( [] );
  const [loading, setLoading] = useState( true );
  const [error, setError] = useState<string | null>( null );
  const [filters, setFilters] = useState<TransactionFilters>( () => ( {
    categoryId: searchParams.get( "categoryId" ) ?? undefined,
    startDate: searchParams.get( "startDate" ) ?? undefined,
    endDate: searchParams.get( "endDate" ) ?? undefined,
  } ) );
  const [searchQuery, setSearchQuery] = useState( "" );
  const [showFilters, setShowFilters] = useState( () =>
    !!( searchParams.get( "categoryId" ) || searchParams.get( "startDate" ) )
  );
  const [showModal, setShowModal] = useState( false );
  const [editingTxn, setEditingTxn] = useState<Transaction | null>( null );
  const [groupBy, setGroupBy] = useState<"date" | "category" | "account" | "none">( "date" );

  useEffect( () => {
    if ( !user ) return;

    async function fetchData () {
      setLoading( true );
      setError( null );
      const supabase = createClient();

      const [txnRes, accRes, catRes, loanRes] = await Promise.all( [
        supabase
          .from( "transactions" )
          .select( "*, account:accounts(*), category:categories(*), loan:loans(id, name)" )
          .eq( "user_id", user!.id )
          .order( "date", { ascending: false } )
          .limit( 100 ),
        supabase
          .from( "accounts" )
          .select( "*" )
          .eq( "user_id", user!.id )
          .eq( "is_active", true )
          .order( "name" ),
        supabase
          .from( "categories" )
          .select( "*" )
          .eq( "user_id", user!.id )
          .order( "name" ),
        supabase
          .from( "loans" )
          .select( "id, name, current_balance" )
          .eq( "user_id", user!.id )
          .eq( "is_active", true )
          .order( "name" ),
      ] );

      if ( txnRes.error ) {
        setError( txnRes.error.message );
        setLoading( false );
        return;
      }
      if ( accRes.error ) {
        setError( accRes.error.message );
        setLoading( false );
        return;
      }
      if ( catRes.error ) {
        setError( catRes.error.message );
        setLoading( false );
        return;
      }

      setTransactions( txnRes.data ?? [] );
      setAccounts( accRes.data ?? [] );
      setCategories( catRes.data ?? [] );
      setLoans( ( loanRes.data as Loan[] ) ?? [] );
      setLoading( false );
    }

    fetchData();
  }, [user] );

  // Filter transactions
  const filtered = transactions.filter( ( t ) => {
    if ( filters.accountId && t.account_id !== filters.accountId ) return false;
    if ( filters.categoryId && t.category_id !== filters.categoryId ) return false;
    if ( filters.startDate && t.date < filters.startDate ) return false;
    if ( filters.endDate && t.date > filters.endDate ) return false;
    if ( searchQuery && !t.description.toLowerCase().includes( searchQuery.toLowerCase() ) ) return false;
    return true;
  } );

  // Grouped for display
  const grouped = ( () => {
    if ( groupBy === "none" ) return { "All Transactions": filtered };
    if ( groupBy === "date" ) {
      const map: Record<string, Transaction[]> = {};
      filtered.forEach( ( t ) => {
        const key = formatDate( t.date, "long" );
        if ( !map[key] ) map[key] = [];
        map[key].push( t );
      } );
      return map;
    }
    if ( groupBy === "category" ) {
      const map: Record<string, Transaction[]> = {};
      filtered.forEach( ( t ) => {
        const cat = categories.find( ( c ) => c.id === t.category_id )?.name ?? "Uncategorized";
        if ( !map[cat] ) map[cat] = [];
        map[cat].push( t );
      } );
      return map;
    }
    if ( groupBy === "account" ) {
      const map: Record<string, Transaction[]> = {};
      filtered.forEach( ( t ) => {
        const acc = accounts.find( ( a ) => a.id === t.account_id )?.name ?? "Unknown";
        if ( !map[acc] ) map[acc] = [];
        map[acc].push( t );
      } );
      return map;
    }
    return { "All Transactions": filtered };
  } )();

  function getCategory ( id: string ) {
    return categories.find( ( c ) => c.id === id );
  }
  function getAccount ( id: string ) {
    return accounts.find( ( a ) => a.id === id );
  }

  function handleEdit ( txn: Transaction ) {
    setEditingTxn( txn );
    setShowModal( true );
  }

  async function handleDelete ( id: string ) {
    const res = await fetch( `/api/transactions/${ id }`, { method: "DELETE" } );
    if ( !res.ok ) {
      console.error( "Failed to delete transaction" );
      return;
    }
    setTransactions( ( prev ) => prev.filter( ( t ) => t.id !== id ) );
  }

  function handleAdd () {
    setEditingTxn( null );
    setShowModal( true );
  }

  async function handleSave ( txn: Partial<Transaction> & { loan_id?: string | null } ) {
    if ( !user ) return;

    if ( editingTxn ) {
      const res = await fetch( `/api/transactions/${ editingTxn.id }`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify( {
          account_id: txn.account_id,
          category_id: txn.category_id ?? null,
          description: txn.description,
          amount_usd: txn.amount_usd,
          cr_dr: txn.cr_dr,
          date: txn.date,
          notes: txn.notes ?? null,
          loan_id: txn.loan_id ?? null,
        } ),
      } );
      if ( !res.ok ) {
        console.error( "Failed to update transaction" );
        return;
      }
      const data = await res.json();
      setTransactions( ( prev ) => prev.map( ( t ) => t.id === editingTxn.id ? data : t ) );
    } else {
      const res = await fetch( "/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify( {
          account_id: txn.account_id,
          category_id: txn.category_id ?? null,
          description: txn.description,
          amount_usd: txn.amount_usd,
          cr_dr: txn.cr_dr,
          date: txn.date,
          notes: txn.notes ?? null,
          loan_id: txn.loan_id ?? null,
        } ),
      } );
      if ( !res.ok ) {
        console.error( "Failed to create transaction" );
        return;
      }
      const data = await res.json();
      setTransactions( ( prev ) => [data, ...prev] );
    }
    setShowModal( false );
  }

  const totalIncome = filtered.filter( ( t ) => t.cr_dr === "credit" ).reduce( ( s, t ) => s + t.final_amount, 0 );
  const totalExpenses = filtered.filter( ( t ) => t.cr_dr === "debit" ).reduce( ( s, t ) => s + Math.abs( t.final_amount ), 0 );

  if ( loading ) {
    return (
      <TablePageSkeleton rows={10} />
    );
  }

  if ( error ) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  const drillDownCategory = filters.categoryId
    ? categories.find( ( c ) => c.id === filters.categoryId )
    : null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Drill-down breadcrumb */}
      {drillDownCategory && filters.startDate && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <a
            href="/budgets"
            className="flex items-center gap-1.5 hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Budgets
          </a>
          <span className="text-[var(--color-text-muted)]">/</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {drillDownCategory.icon} {drillDownCategory.name}
          </span>
          {filters.startDate && (
            <>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span>
                {new Date( filters.startDate ).toLocaleDateString( "en-US", { month: "long", year: "numeric" } )}
              </span>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            {filtered.length} transactions ·{" "}
            <span className="text-[var(--color-income)]">+{formatCurrency( totalIncome )}</span>{" "}
            · <span className="text-[var(--color-expense)]">-{formatCurrency( totalExpenses )}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowFilters( !showFilters )}>
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Filters</span>
            {Object.keys( filters ).length > 0 && ` (${ Object.keys( filters ).length })`}
          </Button>
          <select
            className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 text-xs text-[var(--color-text-secondary)]"
            value={groupBy}
            onChange={( e ) => setGroupBy( e.target.value as typeof groupBy )}
          >
            <option value="date">Group by Date</option>
            <option value="category">Group by Category</option>
            <option value="account">Group by Account</option>
            <option value="none">No grouping</option>
          </select>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="inline">Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Account</label>
              <select
                className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                value={filters.accountId ?? ""}
                onChange={( e ) => setFilters( { ...filters, accountId: e.target.value || undefined } )}
              >
                <option value="">All Accounts</option>
                {accounts.map( ( a ) => <option key={a.id} value={a.id}>{a.name}</option> )}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Category</label>
              <select
                className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                value={filters.categoryId ?? ""}
                onChange={( e ) => setFilters( { ...filters, categoryId: e.target.value || undefined } )}
              >
                <option value="">All Categories</option>
                {categories.map( ( c ) => <option key={c.id} value={c.id}>{c.name}</option> )}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">From</label>
              <input
                type="date"
                className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                value={filters.startDate ?? ""}
                onChange={( e ) => setFilters( { ...filters, startDate: e.target.value || undefined } )}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">To</label>
              <input
                type="date"
                className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                value={filters.endDate ?? ""}
                onChange={( e ) => setFilters( { ...filters, endDate: e.target.value || undefined } )}
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => setFilters( {} )}>
                Clear filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search transactions..."
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm placeholder:text-[var(--color-text-muted)]"
          value={searchQuery}
          onChange={( e ) => setSearchQuery( e.target.value )}
        />
      </div>

      {/* Transaction List */}
      <div className="space-y-6">
        {Object.entries( grouped ).map( ( [group, txns] ) => (
          <div key={group}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">{group}</h3>
              <span className="text-xs text-[var(--color-text-muted)]">
                {txns.length} · {formatCurrency( txns.reduce( ( s, t ) => s + t.final_amount, 0 ) )}
              </span>
            </div>
            <Card className="divide-y divide-[var(--color-border)]">
              {txns.map( ( txn ) => (
                <div
                  key={txn.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
                  onClick={() => handleEdit( txn )}
                >
                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ txn.cr_dr === "credit"
                        ? "bg-[var(--color-income)]/10 text-[var(--color-income)]"
                        : "bg-[var(--color-expense)]/10 text-[var(--color-expense)]"
                      }`}
                  >
                    {txn.cr_dr === "credit" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>

                  {/* Main */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{txn.description}</span>
                      {txn.flagged && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]" />
                      )}
                      {txn.is_recurring && (
                        <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                          RECURRING
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {getCategory( txn.category_id ?? "" )?.name ?? "Uncategorized"}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">·</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {getAccount( txn.account_id )?.name}
                      </span>
                      {txn.ai_categorized && (
                        <>
                          <span className="text-xs text-[var(--color-text-muted)]">·</span>
                          <span className="text-xs text-[var(--color-accent)]">AI</span>
                        </>
                      )}
                      {( txn as Transaction & { loan?: { name: string } } ).loan && (
                        <>
                          <span className="text-xs text-[var(--color-text-muted)]">·</span>
                          <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                            LOAN: {( txn as Transaction & { loan?: { name: string } } ).loan!.name}
                          </span>
                        </>
                      )}
                    </div>
                    {txn.flagged_reason && (
                      <p className="text-xs text-[var(--color-warning)] mt-0.5">{txn.flagged_reason}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-medium ${ txn.cr_dr === "credit"
                          ? "text-[var(--color-income)]"
                          : "text-[var(--color-text-primary)]"
                        }`}
                    >
                      {txn.cr_dr === "credit" ? "+" : ""}
                      {formatCurrency( txn.final_amount )}
                    </span>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {formatDate( txn.date )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={( e ) => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={() => handleEdit( txn )}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      onClick={() => handleDelete( txn.id )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) )}
            </Card>
          </div>
        ) )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[var(--color-text-muted)]">No transactions found</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add your first transaction
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <TransactionModal
          txn={editingTxn}
          accounts={accounts}
          categories={categories}
          loans={loans}
          onSave={handleSave}
          onClose={() => setShowModal( false )}
        />
      )}
    </div>
  );
}

export default function TransactionsPage () {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent)]" />
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionModal ( {
  txn,
  accounts,
  categories,
  loans,
  onSave,
  onClose,
}: {
  txn: Transaction | null;
  accounts: Account[];
  categories: Category[];
  loans: Loan[];
  onSave: ( t: Partial<Transaction> & { loan_id?: string | null } ) => void;
  onClose: () => void;
} ) {
  const [description, setDescription] = useState( txn?.description ?? "" );
  const [amount, setAmount] = useState( txn ? Math.abs( txn.amount_usd ).toString() : "" );
  const [crDr, setCrDr] = useState<"credit" | "debit">( txn?.cr_dr ?? "debit" );
  const [accountId, setAccountId] = useState( txn?.account_id ?? accounts[0]?.id ?? "" );
  const [categoryId, setCategoryId] = useState( txn?.category_id ?? "" );
  const [date, setDate] = useState( txn?.date ?? new Date().toISOString().split( "T" )[0] );
  const [notes, setNotes] = useState( txn?.notes ?? "" );
  const [loanId, setLoanId] = useState<string>( ( txn as Transaction & { loan_id?: string } )?.loan_id ?? "" );

  function handleSubmit ( e: React.FormEvent ) {
    e.preventDefault();
    if ( !description || !amount ) return;
    onSave( {
      description,
      amount_usd: parseFloat( amount ),
      cr_dr: crDr,
      account_id: accountId,
      category_id: categoryId || null,
      date,
      notes: notes || null,
      loan_id: loanId || null,
    } );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{txn ? "Edit Transaction" : "Add Transaction"}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${ crDr === "debit" ? "bg-[var(--color-danger)] text-white" : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" }`}
              onClick={() => setCrDr( "debit" )}
            >
              Expense
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium ${ crDr === "credit" ? "bg-[var(--color-income)] text-white" : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]" }`}
              onClick={() => setCrDr( "credit" )}
            >
              Income
            </button>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Description</label>
            <input
              type="text"
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              placeholder="e.g. Whole Foods Market"
              value={description}
              onChange={( e ) => setDescription( e.target.value )}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Amount</label>
              <input
                type="number"
                step="0.01"
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                placeholder="0.00"
                value={amount}
                onChange={( e ) => setAmount( e.target.value )}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Date</label>
              <input
                type="date"
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                value={date}
                onChange={( e ) => setDate( e.target.value )}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Account</label>
            <select
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              value={accountId}
              onChange={( e ) => setAccountId( e.target.value )}
            >
              {accounts.map( ( a ) => <option key={a.id} value={a.id}>{a.name}</option> )}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Category</label>
            <select
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              value={categoryId}
              onChange={( e ) => setCategoryId( e.target.value )}
            >
              <option value="">Select category</option>
              {categories.map( ( c ) => <option key={c.id} value={c.id}>{c.name}</option> )}
            </select>
          </div>

          {loans.length > 0 && crDr === "debit" && (
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Link to Loan (optional)</label>
              <select
                className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                value={loanId}
                onChange={( e ) => setLoanId( e.target.value )}
              >
                <option value="">— No loan link —</option>
                {loans.map( ( l ) => (
                  <option key={l.id} value={l.id}>
                    {l.name} (bal: {formatCurrency( l.current_balance )})
                  </option>
                ) )}
              </select>
              {loanId && (
                <p className="text-[0.65rem] text-amber-400 mt-1">
                  This payment will reduce the selected loan balance.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Notes (optional)</label>
            <input
              type="text"
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
              placeholder="Add notes..."
              value={notes}
              onChange={( e ) => setNotes( e.target.value )}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {txn ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
