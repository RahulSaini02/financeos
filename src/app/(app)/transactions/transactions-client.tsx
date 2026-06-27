"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Transaction, Account, Category, Loan } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ArrowLeft,
  Download,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  History,
  X,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionModal } from "@/components/transactions/transaction-modal";

const PAGE_SIZE = 50;

function get6MonthsAgo () {
  const d = new Date();
  d.setMonth( d.getMonth() - 6 );
  return d.toISOString().split( "T" )[0];
}

interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  txnType?: "all" | "credit" | "debit" | "transfer";
  flagged?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

// ── CSV export: fetches all matching transactions (no page limit) ────────────
async function exportToCsv ( filters: TransactionFilters, searchQuery: string, windowStart: string | null ) {
  const params = buildParams( filters, searchQuery, windowStart, 0, 5000 );
  const res = await fetch( `/api/transactions?${ params }` );
  if ( !res.ok ) return;
  const json = await res.json();
  const rows: Transaction[] = Array.isArray( json ) ? json : json.data ?? [];

  const headers = ["Date", "Description", "Account", "Category", "Type", "Amount", "Flagged", "Notes"];
  const lines = rows.map( ( t ) => {
    const account = ( t as Transaction & { account?: { name: string } } ).account?.name ?? "";
    const category = ( t as Transaction & { category?: { name: string } } ).category?.name ?? "Uncategorized";
    const type = t.is_internal_transfer ? "Transfer" : t.cr_dr === "credit" ? "Credit" : "Debit";
    const amount = t.cr_dr === "credit"
      ? Math.abs( t.final_amount ).toFixed( 2 )
      : ( -Math.abs( t.final_amount ) ).toFixed( 2 );
    return [
      t.date,
      `"${ t.description.replace( /"/g, '""' ) }"`,
      `"${ account }"`,
      `"${ category }"`,
      type,
      amount,
      t.flagged ? "Yes" : "No",
      `"${ ( t.notes ?? "" ).replace( /"/g, '""' ) }"`,
    ].join( "," );
  } );

  const csv = [headers.join( "," ), ...lines].join( "\n" );
  const blob = new Blob( [csv], { type: "text/csv;charset=utf-8;" } );
  const url = URL.createObjectURL( blob );
  const a = document.createElement( "a" );
  a.href = url;
  a.download = `transactions-${ new Date().toISOString().split( "T" )[0] }.csv`;
  a.click();
  URL.revokeObjectURL( url );
}

function buildParams (
  filters: TransactionFilters,
  search: string,
  windowStart: string | null,
  offset: number,
  limit: number
): string {
  const p = new URLSearchParams();
  p.set( "limit", String( limit ) );
  p.set( "offset", String( offset ) );

  // Date range: user's explicit filter takes precedence over the window
  const effectiveStart = filters.startDate ?? windowStart;
  if ( effectiveStart ) p.set( "startDate", effectiveStart );
  if ( filters.endDate ) p.set( "endDate", filters.endDate );
  if ( filters.accountId ) p.set( "accountId", filters.accountId );
  if ( filters.categoryId ) p.set( "categoryId", filters.categoryId );
  if ( search ) p.set( "search", search );
  if ( filters.txnType && filters.txnType !== "all" ) p.set( "txnType", filters.txnType );
  if ( filters.flagged ) p.set( "flagged", "true" );
  if ( filters.minAmount !== undefined ) p.set( "minAmount", String( filters.minAmount ) );
  if ( filters.maxAmount !== undefined ) p.set( "maxAmount", String( filters.maxAmount ) );
  return p.toString();
}

interface TransactionsClientProps {
  initialAccounts?: Account[];
  initialCategories?: Category[];
  initialLoans?: Loan[];
  initialWindowStart?: string | null;
}

function TransactionsContent ( {
  initialAccounts,
  initialCategories,
  initialLoans,
  initialWindowStart,
}: TransactionsClientProps ) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>( [] );
  const [totalCount, setTotalCount] = useState( 0 );
  const [page, setPage] = useState( 0 );

  // windowStart = the lower date boundary; null = all time
  const [windowStart, setWindowStart] = useState<string | null>( () =>
    initialWindowStart !== undefined ? initialWindowStart : get6MonthsAgo()
  );

  const [accounts, setAccounts] = useState<Account[]>( initialAccounts ?? [] );
  const [categories, setCategories] = useState<Category[]>( initialCategories ?? [] );
  const [loans, setLoans] = useState<Loan[]>( initialLoans ?? [] );
  const [loading, setLoading] = useState( true );
  const [error, setError] = useState<string | null>( null );
  const [filters, setFilters] = useState<TransactionFilters>( () => ( {
    categoryId: searchParams.get( "categoryId" ) ?? undefined,
    startDate: searchParams.get( "startDate" ) ?? undefined,
    endDate: searchParams.get( "endDate" ) ?? undefined,
    txnType: "all",
    flagged: searchParams.get( "flagged" ) === "true" ? true : undefined,
  } ) );
  const [searchQuery, setSearchQuery] = useState( "" );
  const [debouncedSearch, setDebouncedSearch] = useState( "" );
  const [showFilters, setShowFilters] = useState( () =>
    !!( searchParams.get( "categoryId" ) || searchParams.get( "startDate" ) )
  );
  const [showModal, setShowModal] = useState( false );
  const [editingTxn, setEditingTxn] = useState<Transaction | null>( null );
  const [groupBy, setGroupBy] = useState<"date" | "category" | "account" | "none">( "date" );
  const [exporting, setExporting] = useState( false );
  const [selectedIds, setSelectedIds] = useState<Set<string>>( new Set() );
  const [inlineEditId, setInlineEditId] = useState<string | null>( null );
  const [bulkRecategory, setBulkRecategory] = useState<string>( "" );
  const [selectMode, setSelectMode] = useState( false );
  const [alertTooltipId, setAlertTooltipId] = useState<string | null>( null );

  // Close alert tooltip on any document click
  useEffect( () => {
    if ( !alertTooltipId ) return;
    function handleDocClick() { setAlertTooltipId( null ); }
    document.addEventListener( "click", handleDocClick );
    return () => document.removeEventListener( "click", handleDocClick );
  }, [alertTooltipId] );

  // Debounce search input
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>( null );
  useEffect( () => {
    if ( searchTimer.current ) clearTimeout( searchTimer.current );
    searchTimer.current = setTimeout( () => setDebouncedSearch( searchQuery ), 350 );
    return () => { if ( searchTimer.current ) clearTimeout( searchTimer.current ); };
  }, [searchQuery] );

  // Fetch lookup data once if not provided via SSR props
  useEffect( () => {
    if ( !user ) return;
    if ( initialAccounts && initialCategories && initialLoans && initialWindowStart !== undefined ) return;
    const supabase = createClient();
    const sixMonthsAgo = get6MonthsAgo();
    Promise.all( [
      initialAccounts ? Promise.resolve( { data: initialAccounts } ) : supabase.from( "accounts" ).select( "*" ).eq( "user_id", user.id ).eq( "is_active", true ).order( "name" ),
      initialCategories ? Promise.resolve( { data: initialCategories } ) : supabase.from( "categories" ).select( "*" ).eq( "user_id", user.id ).order( "name" ),
      initialLoans ? Promise.resolve( { data: initialLoans } ) : supabase.from( "loans" ).select( "id, name, current_balance" ).eq( "user_id", user.id ).order( "name" ),
      // Find the oldest transaction to decide whether to apply the 6-month window
      initialWindowStart !== undefined ? Promise.resolve( { data: null } ) : supabase.from( "transactions" ).select( "date" ).eq( "user_id", user.id ).order( "date", { ascending: true } ).limit( 1 ),
    ] ).then( ( [accRes, catRes, loanRes, minDateRes] ) => {
      if ( !initialAccounts ) setAccounts( accRes.data ?? [] );
      if ( !initialCategories ) setCategories( catRes.data ?? [] );
      if ( !initialLoans ) setLoans( ( loanRes.data as Loan[] ) ?? [] );

      if ( initialWindowStart === undefined ) {
        // Only apply the 6-month window if there are transactions older than 6 months
        const oldest = ( minDateRes as { data: Array<{ date: string }> | null } ).data?.[0]?.date ?? null;
        if ( !oldest || oldest >= sixMonthsAgo ) {
          setWindowStart( null );
        }
      }
    } );
  }, [user] ); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch transactions page whenever filters/page/window changes
  const fetchPage = useCallback( async ( p: number ) => {
    if ( !user ) return;
    setLoading( true );
    setError( null );
    try {
      const params = buildParams( filters, debouncedSearch, windowStart, p * PAGE_SIZE, PAGE_SIZE );
      const res = await fetch( `/api/transactions?${ params }` );
      if ( !res.ok ) throw new Error( "Failed to load transactions" );
      const json = await res.json();
      setTransactions( Array.isArray( json ) ? json : json.data ?? [] );
      setTotalCount( json.count ?? 0 );
    } catch ( e ) {
      setError( e instanceof Error ? e.message : "Failed to load" );
    } finally {
      setLoading( false );
    }
  }, [user, filters, debouncedSearch, windowStart] );

  useEffect( () => {
    setPage( 0 );
    setSelectedIds( new Set() );
  }, [filters, debouncedSearch, windowStart] );

  useEffect( () => {
    setSelectedIds( new Set() );
  }, [page] );

  useEffect( () => {
    fetchPage( page );
  }, [page, fetchPage] );

  const totalPages = Math.max( 1, Math.ceil( totalCount / PAGE_SIZE ) );
  const isLastPage = page >= totalPages - 1;
  const isWindowLimited = windowStart !== null && !filters.startDate;

  // ── Amount filter (client-side) ──────────────────────────────────────────────
  const isAmountFiltered = filters.minAmount !== undefined || filters.maxAmount !== undefined;
  const displayTransactions = isAmountFiltered
    ? transactions.filter( ( t ) => {
        const abs = Math.abs( t.final_amount );
        if ( filters.minAmount !== undefined && abs < filters.minAmount ) return false;
        if ( filters.maxAmount !== undefined && abs > filters.maxAmount ) return false;
        return true;
      } )
    : transactions;

  // ── Grouped for display ──────────────────────────────────────────────────────
  const grouped = ( () => {
    if ( groupBy === "none" ) return { "All Transactions": displayTransactions };
    if ( groupBy === "date" ) {
      const map: Record<string, Transaction[]> = {};
      displayTransactions.forEach( ( t ) => {
        const key = formatDate( t.date, "long" );
        if ( !map[key] ) map[key] = [];
        map[key].push( t );
      } );
      return map;
    }
    if ( groupBy === "category" ) {
      const map: Record<string, Transaction[]> = {};
      displayTransactions.forEach( ( t ) => {
        const cat = categories.find( ( c ) => c.id === t.category_id )?.name ?? "Uncategorized";
        if ( !map[cat] ) map[cat] = [];
        map[cat].push( t );
      } );
      return map;
    }
    if ( groupBy === "account" ) {
      const map: Record<string, Transaction[]> = {};
      displayTransactions.forEach( ( t ) => {
        const acc = accounts.find( ( a ) => a.id === t.account_id )?.name ?? "Unknown";
        if ( !map[acc] ) map[acc] = [];
        map[acc].push( t );
      } );
      return map;
    }
    return { "All Transactions": displayTransactions };
  } )();

  function getCategory ( id: string ) { return categories.find( ( c ) => c.id === id ); }
  function getAccount ( id: string ) { return accounts.find( ( a ) => a.id === id ); }
  function handleEdit ( txn: Transaction ) { setEditingTxn( txn ); setShowModal( true ); }
  function handleAdd () { setEditingTxn( null ); setShowModal( true ); }

  async function handleDelete ( id: string ) {
    const res = await fetch( `/api/transactions/${ id }`, { method: "DELETE" } );
    if ( !res.ok ) return;
    fetchPage( page );
  }

  async function handleSave ( txn: Partial<Transaction> & { loan_id?: string | null; target_account_id?: string | null } ) {
    if ( !user ) return;
    if ( editingTxn ) {
      await fetch( `/api/transactions/${ editingTxn.id }`, {
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
    } else {
      await fetch( "/api/transactions", {
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
          target_account_id: txn.target_account_id ?? null,
        } ),
      } );
    }
    setShowModal( false );
    fetchPage( page );
  }

  function handleLoadOlder () {
    setWindowStart( null );
  }

  function handleFilterChange ( next: TransactionFilters ) {
    setFilters( next );
  }

  async function handleBulkDelete () {
    if ( selectedIds.size === 0 ) return;
    if ( !window.confirm( `Delete ${ selectedIds.size } transaction${ selectedIds.size !== 1 ? "s" : "" }?` ) ) return;
    const res = await fetch( "/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { action: "delete", ids: Array.from( selectedIds ) } ),
    } );
    if ( !res.ok ) return;
    setSelectedIds( new Set() );
    fetchPage( page );
  }

  async function handleBulkRecategorize ( categoryId: string ) {
    if ( selectedIds.size === 0 || !categoryId ) return;
    const res = await fetch( "/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { action: "recategorize", ids: Array.from( selectedIds ), category_id: categoryId || null } ),
    } );
    if ( !res.ok ) return;
    setSelectedIds( new Set() );
    setBulkRecategory( "" );
    fetchPage( page );
  }

  async function handleInlineCategoryChange ( txnId: string, categoryId: string ) {
    setTransactions( ( prev ) =>
      prev.map( ( t ) => ( t.id === txnId ? { ...t, category_id: categoryId || null } : t ) )
    );
    setInlineEditId( null );
    const res = await fetch( `/api/transactions/${ txnId }`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify( { category_id: categoryId || null } ),
    } );
    if ( res.ok ) fetchPage( page );
  }

  const activeFilterCount = [
    filters.accountId,
    filters.categoryId,
    filters.startDate,
    filters.endDate,
    filters.txnType && filters.txnType !== "all" ? filters.txnType : undefined,
    filters.flagged ? true : undefined,
    filters.minAmount !== undefined ? true : undefined,
    filters.maxAmount !== undefined ? true : undefined,
  ].filter( Boolean ).length;

  const drillDownCategory = filters.categoryId && filters.categoryId !== "__uncategorized__"
    ? categories.find( ( c ) => c.id === filters.categoryId ) ?? null
    : null;

  // Summary of current page amounts (non-transfer, after client-side amount filter)
  const pageIncome = displayTransactions.filter( t => t.cr_dr === "credit" && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.final_amount ), 0 );
  const pageExpenses = displayTransactions.filter( t => t.cr_dr === "debit" && !t.is_internal_transfer ).reduce( ( s, t ) => s + Math.abs( t.final_amount ), 0 );

  if ( loading && transactions.length === 0 ) return <TablePageSkeleton rows={10} />;

  if ( error ) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">

      {/* Drill-down breadcrumb */}
      {drillDownCategory && filters.startDate && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <a href="/budgets" className="flex items-center gap-1.5 hover:text-[var(--color-text-primary)] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Budgets
          </a>
          <span className="text-[var(--color-text-muted)]">/</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {drillDownCategory.icon} {drillDownCategory.name}
          </span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <span>
            {new Date( filters.startDate + "T00:00:00" ).toLocaleDateString( "en-US", { month: "long", year: "numeric" } )}
          </span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Transactions"
        subtitle={
          loading
            ? "Loading…"
            : `${ isAmountFiltered ? displayTransactions.length : totalCount } total · +${ formatCurrency( pageIncome ) } · -${ formatCurrency( pageExpenses ) } this page${ isAmountFiltered ? " (filtered locally)" : "" }`
        }
        tooltip={
          <HelpModal
            title="Transactions"
            description="Record, review, and manage every income and expense. Defaults to the last 6 months — use 'Load older' to go further back."
            sections={[
              {
                heading: "How to use",
                items: [
                  "Defaults to the last 6 months with 50 transactions per page",
                  "Use Previous / Next to page through results",
                  "Click 'Load older transactions' to fetch history beyond 6 months",
                  "Use the Type filter to show only credits, debits, or transfers",
                  "Export CSV downloads all matching transactions (not just this page)",
                ],
              },
              {
                heading: "Key actions",
                items: [
                  "Add — record a new credit or debit entry",
                  "Export CSV — download all filtered transactions",
                  "Filter — narrow by type, account, category, or date range",
                  "Edit / Delete — correct mistakes or remove duplicates",
                ],
              },
            ]}
          />
        }
      >
        <Button
          variant="secondary"
          size="sm"
          disabled={exporting}
          onClick={async () => {
            setExporting( true );
            await exportToCsv( filters, debouncedSearch, windowStart );
            setExporting( false );
          }}
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <Download className="h-3.5 w-3.5 sm:mr-1.5" />}
          <span className="hidden sm:inline">Export</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowFilters( !showFilters )}>
          <Filter className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && ` (${ activeFilterCount })`}
        </Button>
        <button
          onClick={() => { setSelectMode( v => !v ); if ( selectMode ) setSelectedIds( new Set() ); }}
          className={`flex items-center gap-1 h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors ${ selectMode
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            : "border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
          }`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-0.5">{selectMode ? "Cancel" : "Select"}</span>
        </button>
        <select
          className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 text-xs text-[var(--color-text-secondary)] flex items-center self-center"
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
          <span className="inline">Add</span>
        </Button>
      </PageHeader>

      {/* 6-month window banner */}
      {isWindowLimited && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] min-w-0">
            <History className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
            <span className="truncate">
              From{" "}
              <span className="font-medium text-[var(--color-text-primary)]">
                {new Date( windowStart + "T00:00:00" ).toLocaleDateString( "en-US", { month: "short", day: "numeric", year: "numeric" } )}
              </span>
              {" "}to today
            </span>
          </div>
          <button
            onClick={handleLoadOlder}
            className="text-xs font-medium text-[var(--color-accent)] hover:underline shrink-0"
          >
            Load all history
          </button>
        </div>
      )}

      {/* Filters panel */}
      {showFilters && (
        <>
          {/* Mobile: backdrop + bottom sheet */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowFilters( false )}
          />
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] rounded-t-2xl shadow-2xl">
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
            </div>
            <div className="px-4 pt-2 max-h-[80vh] overflow-y-auto" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
              <h3 className="text-sm font-semibold mb-3">Filters</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Type</label>
                  <select
                    className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                    value={filters.txnType ?? "all"}
                    onChange={( e ) => handleFilterChange( { ...filters, txnType: e.target.value as TransactionFilters["txnType"] } )}
                  >
                    <option value="all">All Types</option>
                    <option value="credit">Credits Only</option>
                    <option value="debit">Debits Only</option>
                    <option value="transfer">Transfers Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Account</label>
                  <select
                    className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                    value={filters.accountId ?? ""}
                    onChange={( e ) => handleFilterChange( { ...filters, accountId: e.target.value || undefined } )}
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
                    onChange={( e ) => handleFilterChange( { ...filters, categoryId: e.target.value || undefined } )}
                  >
                    <option value="">All Categories</option>
                    <option value="__uncategorized__">Uncategorized</option>
                    {categories.map( ( c ) => <option key={c.id} value={c.id}>{c.name}</option> )}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">From</label>
                  <input
                    type="date"
                    className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                    value={filters.startDate ?? ""}
                    onChange={( e ) => handleFilterChange( { ...filters, startDate: e.target.value || undefined } )}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">To</label>
                  <input
                    type="date"
                    className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                    value={filters.endDate ?? ""}
                    onChange={( e ) => handleFilterChange( { ...filters, endDate: e.target.value || undefined } )}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Min Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                    placeholder="0.00"
                    value={filters.minAmount ?? ""}
                    onChange={( e ) => handleFilterChange( { ...filters, minAmount: e.target.value !== "" ? parseFloat( e.target.value ) : undefined } )}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Max Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                    placeholder="Any"
                    value={filters.maxAmount ?? ""}
                    onChange={( e ) => handleFilterChange( { ...filters, maxAmount: e.target.value !== "" ? parseFloat( e.target.value ) : undefined } )}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Flagged Only</label>
                  <div className="h-8 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="flagged-filter-mobile"
                      checked={!!filters.flagged}
                      onChange={( e ) => handleFilterChange( { ...filters, flagged: e.target.checked ? true : undefined } )}
                      className="h-4 w-4 rounded accent-[var(--color-accent)] cursor-pointer"
                    />
                    <label htmlFor="flagged-filter-mobile" className="text-sm text-[var(--color-text-secondary)] cursor-pointer select-none">
                      Show flagged
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleFilterChange( { txnType: "all" } )}>Clear</Button>
                <Button size="sm" className="flex-1" onClick={() => setShowFilters( false )}>Apply</Button>
              </div>
            </div>
          </div>

          {/* Desktop: inline card */}
          <Card className="hidden lg:block p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Type</label>
                <select
                  className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                  value={filters.txnType ?? "all"}
                  onChange={( e ) => handleFilterChange( { ...filters, txnType: e.target.value as TransactionFilters["txnType"] } )}
                >
                  <option value="all">All Types</option>
                  <option value="credit">Credits Only</option>
                  <option value="debit">Debits Only</option>
                  <option value="transfer">Transfers Only</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Account</label>
                <select
                  className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                  value={filters.accountId ?? ""}
                  onChange={( e ) => handleFilterChange( { ...filters, accountId: e.target.value || undefined } )}
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
                  onChange={( e ) => handleFilterChange( { ...filters, categoryId: e.target.value || undefined } )}
                >
                  <option value="">All Categories</option>
                  <option value="__uncategorized__">Uncategorized</option>
                  {categories.map( ( c ) => <option key={c.id} value={c.id}>{c.name}</option> )}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">From</label>
                <input
                  type="date"
                  className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                  value={filters.startDate ?? ""}
                  onChange={( e ) => handleFilterChange( { ...filters, startDate: e.target.value || undefined } )}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">To</label>
                <input
                  type="date"
                  className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                  value={filters.endDate ?? ""}
                  onChange={( e ) => handleFilterChange( { ...filters, endDate: e.target.value || undefined } )}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Min Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                  placeholder="0.00"
                  value={filters.minAmount ?? ""}
                  onChange={( e ) => handleFilterChange( { ...filters, minAmount: e.target.value !== "" ? parseFloat( e.target.value ) : undefined } )}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Max Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-sm"
                  placeholder="Any"
                  value={filters.maxAmount ?? ""}
                  onChange={( e ) => handleFilterChange( { ...filters, maxAmount: e.target.value !== "" ? parseFloat( e.target.value ) : undefined } )}
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Flagged Only</label>
                <div className="h-8 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="flagged-filter"
                    checked={!!filters.flagged}
                    onChange={( e ) => handleFilterChange( { ...filters, flagged: e.target.checked ? true : undefined } )}
                    className="h-4 w-4 rounded accent-[var(--color-accent)] cursor-pointer"
                  />
                  <label htmlFor="flagged-filter" className="text-sm text-[var(--color-text-secondary)] cursor-pointer select-none">
                    Show flagged
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => handleFilterChange( { txnType: "all" } )}>
                Clear filters
              </Button>
            </div>
          </Card>
        </>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search transactions…"
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm placeholder:text-[var(--color-text-muted)]"
          value={searchQuery}
          onChange={( e ) => setSearchQuery( e.target.value )}
        />
        {loading && transactions.length > 0 && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--color-text-muted)]" />
        )}
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
                  className="flex items-start gap-3 px-3 py-3 hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer sm:items-center sm:px-4"
                  onClick={() => handleEdit( txn )}
                >
                  {/* Bulk select checkbox — only visible in select mode */}
                  {selectMode && (
                    <div
                      className="flex items-center shrink-0 self-center"
                      onClick={( e ) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has( txn.id )}
                        onChange={() => {
                          setSelectedIds( ( prev ) => {
                            const next = new Set( prev );
                            if ( next.has( txn.id ) ) next.delete( txn.id );
                            else next.add( txn.id );
                            return next;
                          } );
                        }}
                        className="h-4 w-4 rounded accent-[var(--color-accent)] cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5 sm:mt-0 ${ txn.is_internal_transfer
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : txn.cr_dr === "credit"
                        ? "bg-[var(--color-income)]/10 text-[var(--color-income)]"
                        : "bg-[var(--color-expense)]/10 text-[var(--color-expense)]"
                      }`}
                  >
                    {txn.is_internal_transfer ? (
                      <ArrowRightLeft className="h-4 w-4" />
                    ) : txn.cr_dr === "credit" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>

                  {/* Main */}
                  <div className="flex-1 min-w-0">

                    {/* ── MOBILE CARD (sm:hidden) ── */}
                    <div className="sm:hidden">
                      {/* Title row: name · flag · amount · delete */}
                      <div className="flex items-center gap-1.5">
                        <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate min-w-0">
                          {txn.description}
                        </span>
                        {txn.flagged && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]" />
                        )}
                        <span
                          className={`text-sm font-medium whitespace-nowrap shrink-0 ${
                            txn.cr_dr === "credit"
                              ? "text-[var(--color-income)]"
                              : "text-[var(--color-text-primary)]"
                          }`}
                        >
                          {txn.cr_dr === "credit" ? "+" : ""}
                          {formatCurrency( txn.final_amount )}
                        </span>
                        <button
                          className="shrink-0 p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                          onClick={( e ) => { e.stopPropagation(); handleDelete( txn.id ); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Category */}
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-[var(--color-text-muted)]">
                        <span>{getCategory( txn.category_id ?? "" )?.name ?? "Uncategorized"}</span>
                        {txn.is_internal_transfer && (
                          <>
                            <span>·</span>
                            <span className="text-[var(--color-accent)]">Transfer</span>
                          </>
                        )}
                        {txn.is_recurring && (
                          <>
                            <span>·</span>
                            <span>Recurring</span>
                          </>
                        )}
                      </div>
                      {/* Date */}
                      <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {formatDate( txn.date )}
                      </div>
                      {/* Account */}
                      <div className="mt-0.5 text-xs text-[var(--color-text-muted)] opacity-75">
                        {getAccount( txn.account_id )?.name}
                        {txn.ai_categorized && (
                          <span className="ml-1.5 opacity-100 text-[var(--color-accent)]">· AI</span>
                        )}
                      </div>
                      {/* Flagged reason */}
                      {txn.flagged_reason && (
                        <div className="mt-1 text-xs text-[var(--color-warning)]">
                          {txn.flagged_reason}
                        </div>
                      )}
                    </div>

                    {/* ── DESKTOP ROW (hidden sm:block) ── */}
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{txn.description}</span>
                        {txn.flagged && (
                          <div className="relative shrink-0" onClick={( e ) => e.stopPropagation()}>
                            <button
                              onClick={() => setAlertTooltipId( alertTooltipId === txn.id ? null : txn.id )}
                              className="flex items-center"
                              aria-label="View flag reason"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                            </button>
                            {alertTooltipId === txn.id && txn.flagged_reason && (
                              <div className="absolute top-6 left-0 z-50 w-56 rounded-lg shadow-lg p-2.5 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-warning)]">
                                <div className="absolute -top-1.5 left-2 h-3 w-3 rotate-45 bg-[var(--color-bg-tertiary)] border-t border-l border-[var(--color-border)]" />
                                {txn.flagged_reason}
                              </div>
                            )}
                          </div>
                        )}
                        {txn.is_internal_transfer && (
                          <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                            TRANSFER
                          </span>
                        )}
                        {txn.is_recurring && (
                          <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                            RECURRING
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5" onClick={( e ) => e.stopPropagation()}>
                        {inlineEditId === txn.id ? (
                          <select
                            autoFocus
                            className="text-xs h-6 rounded border border-[var(--color-accent)] bg-[var(--color-bg-tertiary)] px-1 max-w-[140px]"
                            value={txn.category_id ?? ""}
                            onChange={( e ) => handleInlineCategoryChange( txn.id, e.target.value )}
                            onBlur={() => setInlineEditId( null )}
                          >
                            <option value="">Uncategorized</option>
                            {categories.map( ( c ) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ) )}
                          </select>
                        ) : (
                          <button
                            className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] transition-colors"
                            onClick={() => setInlineEditId( txn.id )}
                          >
                            {getCategory( txn.category_id ?? "" )?.name ?? "Uncategorized"}
                          </button>
                        )}
                        <span className="text-xs text-[var(--color-text-muted)]">·</span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {formatDate( txn.date )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[0.7rem] text-[var(--color-text-muted)] opacity-75">
                          {getAccount( txn.account_id )?.name}
                        </span>
                        {txn.ai_categorized && (
                          <>
                            <span className="text-[0.7rem] text-[var(--color-text-muted)] opacity-75">·</span>
                            <span className="text-[0.7rem] text-[var(--color-accent)] opacity-80">AI</span>
                          </>
                        )}
                        {( txn as Transaction & { loan?: { name: string } } ).loan && (
                          <>
                            <span className="text-[0.7rem] text-[var(--color-text-muted)] opacity-75">·</span>
                            <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                              LOAN: {( txn as Transaction & { loan?: { name: string } } ).loan!.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Amount + date — desktop only */}
                  <div className="hidden sm:block text-right shrink-0 whitespace-nowrap">
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

                  {/* Actions — desktop only */}
                  <div className="hidden sm:flex items-center gap-1 shrink-0" onClick={( e ) => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      onClick={() => handleEdit( txn )}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      onClick={() => handleDelete( txn.id )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) )}
            </Card>
          </div>
        ) )}

        {transactions.length === 0 && !loading && (
          <EmptyState
            icon={<Plus className="h-8 w-8" />}
            title="No transactions found"
            action={{ label: "Add your first transaction", onClick: handleAdd }}
          />
        )}
      </div>

      {/* ── Pagination + Load older ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 pt-2">
        {/* Page controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage( ( p ) => Math.max( 0, p - 1 ) )}
              disabled={page === 0 || loading}
              className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)]">
              Page <span className="font-medium text-[var(--color-text-primary)]">{page + 1}</span> of{" "}
              <span className="font-medium text-[var(--color-text-primary)]">{totalPages}</span>
            </span>
            <button
              onClick={() => setPage( ( p ) => Math.min( totalPages - 1, p + 1 ) )}
              disabled={isLastPage || loading}
              className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Load older button — shown when on last page and window is limited to 6 months */}
        {isLastPage && isWindowLimited && (
          <button
            onClick={handleLoadOlder}
            className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            <History className="h-4 w-4" />
            Load transactions before{" "}
            {new Date( windowStart + "T00:00:00" ).toLocaleDateString( "en-US", { month: "short", day: "numeric", year: "numeric" } )}
          </button>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(4rem+1.5rem)] lg:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-xl whitespace-nowrap">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {selectedIds.size} selected
          </span>
          <select
            className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 text-xs text-[var(--color-text-secondary)]"
            value={bulkRecategory}
            onChange={( e ) => {
              setBulkRecategory( e.target.value );
              if ( e.target.value ) handleBulkRecategorize( e.target.value );
            }}
          >
            <option value="">Recategorize…</option>
            {categories.map( ( c ) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ) )}
          </select>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 text-xs font-medium transition-colors"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            onClick={() => setSelectedIds( new Set() )}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mobile FAB — Add transaction */}
      <button
        className="lg:hidden fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] shadow-lg text-white active:scale-95 transition-transform"
        style={{ bottom: "calc(4rem + 1rem + env(safe-area-inset-bottom))" }}
        onClick={handleAdd}
        aria-label="Add transaction"
      >
        <Plus className="h-6 w-6" />
      </button>

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

export function TransactionsClient ( props: TransactionsClientProps ) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent)]" />
        </div>
      }
    >
      <TransactionsContent {...props} />
    </Suspense>
  );
}

export default function TransactionsPage () {
  return <TransactionsClient />;
}
