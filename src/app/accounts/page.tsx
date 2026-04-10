"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AccountsPageSkeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Account, AccountType, AccountKind, CurrencyCode } from "@/lib/types";
import {
  Wallet,
  Landmark,
  CreditCard,
  TrendingUp,
  Plus,
  X,
  Pencil,
  Trash2,
  IndianRupee,
  AlertTriangle,
  Building2,
  TrendingDown,
  PackageOpen,
  Loader2,
  ChevronDown,
} from "lucide-react";

type SortOption = "name_asc" | "name_desc" | "balance_high" | "balance_low" | "currency";

const accountTypeIcons: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  checking: Wallet,
  savings: Landmark,
  credit_card: CreditCard,
  loan: Landmark,
  investment: TrendingUp,
  retirement: TrendingUp,
};

const accountTypeLabels: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  loan: "Loan",
  investment: "Investment",
  retirement: "Retirement",
};

const kindOrder: Record<AccountKind, number> = {
  asset: 0,
  liability: 1,
  investment: 2,
};

const kindConfig: Record<AccountKind, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  asset: { icon: Building2, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  liability: { icon: TrendingDown, color: "text-rose-500", bgColor: "bg-rose-500/10" },
  investment: { icon: TrendingUp, color: "text-violet-500", bgColor: "bg-violet-500/10" },
};

interface AccountFormData {
  name: string;
  type: AccountType;
  kind: AccountKind;
  institution: string;
  last_four: string;
  currency: CurrencyCode;
  current_balance: string;
  is_india_account: boolean;
  is_active: boolean;
}

const emptyFormData: AccountFormData = {
  name: "",
  type: "checking",
  kind: "asset",
  institution: "",
  last_four: "",
  currency: "USD",
  current_balance: "",
  is_india_account: false,
  is_active: true,
};

interface FormErrors {
  name?: string;
  institution?: string;
  current_balance?: string;
  last_four?: string;
}

export default function AccountsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<SortOption>("name_asc");
  const [showInactive, setShowInactive] = useState(false);

  // Fetch accounts from Supabase
  useEffect(() => {
    if (!user) return;

    async function fetchAccounts() {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user!.id)
        .order('name');

      if (!showInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching accounts:', error);
        setError('Failed to load accounts');
      } else {
        setAccounts(data || []);
      }

      setIsLoading(false);
    }

    fetchAccounts();
  }, [user, showInactive]);

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.kind]) acc[account.kind] = [];
    acc[account.kind].push(account);
    return acc;
  }, {} as Record<AccountKind, Account[]>);

  const activeAccounts = accounts.filter((a) => a.is_active);

  // Sort within each group based on selected sort option; inactive always last
  Object.keys(groupedAccounts).forEach((kind) => {
    groupedAccounts[kind as AccountKind].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      switch (sortOption) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "balance_high":
          return Math.abs(b.current_balance) - Math.abs(a.current_balance);
        case "balance_low":
          return Math.abs(a.current_balance) - Math.abs(b.current_balance);
        case "currency":
          // US accounts first, then India
          if (a.is_india_account === b.is_india_account) return 0;
          return a.is_india_account ? 1 : -1;
        default:
          return 0;
      }
    });
  });

  // Sort groups: assets, liabilities, investments
  const sortedKindOrder = Object.keys(groupedAccounts).sort(
    (a, b) => kindOrder[a as AccountKind] - kindOrder[b as AccountKind]
  ) as AccountKind[];

  const totalAssets = activeAccounts
    .filter((a) => a.kind === "asset")
    .reduce((sum, a) => sum + a.current_balance, 0);

  const totalLiabilities = activeAccounts
    .filter((a) => a.kind === "liability")
    .reduce((sum, a) => sum + Math.abs(a.current_balance), 0);

  const totalInvestments = activeAccounts
    .filter((a) => a.kind === "investment")
    .reduce((sum, a) => sum + a.current_balance, 0);

  const netWorth = totalAssets - totalLiabilities;

  const kindLabels: Record<AccountKind, string> = {
    asset: "Assets",
    liability: "Liabilities",
    investment: "Investments",
  };

  const kindTotals: Record<AccountKind, number> = {
    asset: totalAssets,
    liability: totalLiabilities,
    investment: totalInvestments,
  };

  // Sort icons
  const SortIcon = ({ option }: { option: SortOption }) => {
    switch (option) {
      case "name_asc":
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h12M3 12h9M3 17h6" strokeLinecap="round" />
            <path d="M16 8l4-4M20 4l-4-4M20 4v16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "name_desc":
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h12M3 12h9M3 17h6" strokeLinecap="round" />
            <path d="M16 16l4 4M20 20l-4 4M20 20V4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "balance_high":
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20V10M12 10l4 4M12 10l-4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 6h18" strokeLinecap="round" />
          </svg>
        );
      case "balance_low":
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4v10M12 14l4-4M12 14l-4-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 18h18" strokeLinecap="round" />
          </svg>
        );
      case "currency":
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 10h14M7 14h14M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
    }
  };

  const sortLabels: Record<SortOption, string> = {
    name_asc: "Name (A-Z)",
    name_desc: "Name (Z-A)",
    balance_high: "Balance (High → Low)",
    balance_low: "Balance (Low → High)",
    currency: "Currency (US first)",
  };

  // Form validation
  const validateField = (name: keyof AccountFormData, value: string | boolean): string | undefined => {
    switch (name) {
      case "name":
        if (!value || (typeof value === "string" && value.trim().length === 0)) {
          return "Account name is required";
        }
        if (typeof value === "string" && value.trim().length < 2) {
          return "Name must be at least 2 characters";
        }
        break;
      case "institution":
        if (!value || (typeof value === "string" && value.trim().length === 0)) {
          return "Institution is required";
        }
        break;
      case "current_balance":
        if (!value || (typeof value === "string" && value.trim().length === 0)) {
          return "Balance is required";
        }
        if (typeof value === "string" && isNaN(parseFloat(value))) {
          return "Balance must be a valid number";
        }
        break;
      case "last_four":
        if (typeof value === "string" && value && !/^\d{0,4}$/.test(value)) {
          return "Must be up to 4 digits";
        }
        break;
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    const nameError = validateField("name", formData.name);
    const institutionError = validateField("institution", formData.institution);
    const balanceError = validateField("current_balance", formData.current_balance);
    const lastFourError = validateField("last_four", formData.last_four);

    if (nameError) errors.name = nameError;
    if (institutionError) errors.institution = institutionError;
    if (balanceError) errors.current_balance = balanceError;
    if (lastFourError) errors.last_four = lastFourError;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setEditingAccount(null);
    setFormData(emptyFormData);
    setFormErrors({});
    setTouchedFields(new Set());
    setIsModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      kind: account.kind,
      institution: account.institution ?? "",
      last_four: account.last_four || "",
      currency: account.currency,
      current_balance: account.current_balance.toString(),
      is_india_account: account.is_india_account,
      is_active: account.is_active,
    });
    setFormErrors({});
    setTouchedFields(new Set());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setFormData(emptyFormData);
    setFormErrors({});
    setTouchedFields(new Set());
  };

  const openDeleteDialog = (id: string) => {
    setDeletingAccountId(id);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingAccountId(null);
  };

  const handleDelete = async () => {
    if (!deletingAccountId || !user) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', deletingAccountId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account');
      toastError('Failed to delete account');
    } else {
      setAccounts((prev) => prev.filter((a) => a.id !== deletingAccountId));
      toastSuccess('Account deleted');
    }

    setIsSaving(false);
    closeDeleteDialog();
    if (isModalOpen) closeModal();
  };

  const handleToggleActive = async (account: Account) => {
    if (!user) return;
    const newActive = !account.is_active;
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: newActive })
      .eq('id', account.id)
      .eq('user_id', user.id);

    if (error) {
      toastError(`Failed to ${newActive ? 'activate' : 'deactivate'} account`);
    } else {
      setAccounts((prev) =>
        showInactive
          ? prev.map((a) => (a.id === account.id ? { ...a, is_active: newActive } : a))
          : prev.filter((a) => a.id !== account.id)
      );
      toastSuccess(`Account ${newActive ? 'activated' : 'deactivated'}`);
    }
  };

  const handleFieldChange = (field: keyof AccountFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouchedFields((prev) => new Set(prev).add(field));
    const error = validateField(field, value);
    setFormErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleBlur = (field: keyof AccountFormData) => {
    setTouchedFields((prev) => new Set(prev).add(field));
    const error = validateField(field, formData[field]);
    setFormErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setTouchedFields(new Set(Object.keys(formData)));
    if (!validateForm()) return;

    setIsSaving(true);
    setError(null);

    const balance = parseFloat(formData.current_balance) || 0;
    const isLiabilityOrNegative = formData.kind === "liability" || (formData.kind === "asset" && balance < 0);
    const finalBalance = isLiabilityOrNegative ? -Math.abs(balance) : Math.abs(balance);

    const accountData = {
      user_id: user.id,
      name: formData.name.trim(),
      type: formData.type,
      kind: formData.kind,
      institution: formData.institution.trim(),
      last_four: formData.last_four || null,
      currency: formData.currency,
      current_balance: finalBalance,
      opening_balance: finalBalance,
      is_india_account: formData.is_india_account,
      is_active: editingAccount ? formData.is_active : true,
    };

    let success = false;

    if (editingAccount) {
      const { data, error: updateError } = await supabase
        .from('accounts')
        .update(accountData)
        .eq('id', editingAccount.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating account:', updateError);
        setError('Failed to update account');
      } else if (data) {
        setAccounts((prev) => {
          const updated = prev.map((a) => (a.id === editingAccount.id ? data : a));
          return showInactive ? updated : updated.filter((a) => a.is_active);
        });
        success = true;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('accounts')
        .insert(accountData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating account:', insertError);
        setError('Failed to create account');
      } else if (data) {
        setAccounts((prev) => [...prev, data]);
        success = true;
      }
    }

    setIsSaving(false);
    if (success) {
      toastSuccess(editingAccount ? 'Account updated' : 'Account added');
      closeModal();
    }
  };

  const getAccountColor = (balance: number, kind: AccountKind) => {
    if (kind === "liability") return "text-[var(--color-danger)]";
    return balance >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-danger)]";
  };

  // Loading skeleton component
  const SkeletonCard = () => (
    <div className="animate-pulse">
      <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-24 mb-3"></div>
      <div className="h-8 bg-[var(--color-bg-tertiary)] rounded w-32"></div>
    </div>
  );

  const SkeletonAccount = () => (
    <div className="animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[var(--color-bg-tertiary)]"></div>
          <div>
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-24 mb-2"></div>
            <div className="h-3 bg-[var(--color-bg-tertiary)] rounded w-20"></div>
          </div>
        </div>
        <div className="h-6 bg-[var(--color-bg-tertiary)] rounded w-20"></div>
      </div>
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
        <PackageOpen className="h-8 w-8 text-[var(--color-text-muted)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        No accounts yet
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mb-6">
        Get started by adding your first account to track your net worth and manage your finances.
      </p>
      <Button onClick={openAddModal} size="lg">
        <Plus className="h-4 w-4 mr-2" />
        Add Your First Account
      </Button>
    </div>
  );

  // Error display component
  const ErrorDisplay = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-2xl bg-[var(--color-danger)]/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-[var(--color-danger)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        Something went wrong
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mb-6">
        {message}
      </p>
      <Button onClick={() => window.location.reload()} variant="secondary">
        Retry
      </Button>
    </div>
  );

  if (!user) {
    return (
      <AccountsPageSkeleton />
    );
  }

  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Manage your bank accounts and track your net worth
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <SortIcon option={sortOption} />
              <span className="hidden sm:inline">{sortLabels[sortOption]}</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </button>
            {isSortDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSortDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl z-50 py-2">
                  <div className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                    Sort by
                  </div>
                  {(Object.keys(sortLabels) as SortOption[]).map((option) => {
                    const isActive = sortOption === option;
                    return (
                      <button
                        key={option}
                        onClick={() => { setSortOption(option); setIsSortDropdownOpen(false); }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm w-full text-left transition-colors",
                          isActive
                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        <SortIcon option={option} />
                        {sortLabels[option]}
                        {isActive && <span className="ml-auto text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors",
              showInactive
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            )}
          >
            {showInactive ? "Hide inactive" : "Show inactive"}
          </button>
          <Button onClick={openAddModal}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Net Worth Card */}
      <Card className="border-[var(--color-accent)] bg-gradient-to-r from-[var(--color-accent)]/10 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Net Worth</CardTitle>
            <CardValue className={cn("mt-2 text-3xl", getAccountColor(netWorth, "asset"))}>
              {formatCurrency(netWorth)}
            </CardValue>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Assets</p>
              <p className="text-lg font-semibold text-[var(--color-income)] mt-1">
                {formatCurrency(totalAssets)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Liabilities</p>
              <p className="text-lg font-semibold text-[var(--color-danger)] mt-1">
                {formatCurrency(totalLiabilities)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Investments</p>
              <p className="text-lg font-semibold text-[var(--color-income)] mt-1">
                {formatCurrency(totalInvestments)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Account Groups */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonAccount />
          <SkeletonAccount />
          <SkeletonAccount />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState />
      ) : (
        sortedKindOrder.map((kind) => (
          <div key={kind} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">{kindLabels[kind]}</h2>
              <span className={cn(
                "text-sm font-medium",
                kind === "liability" ? "text-[var(--color-danger)]" : "text-[var(--color-income)]"
              )}>
                {formatCurrency(kindTotals[kind], kind === "asset" && accounts.some(a => a.kind === kind && a.currency === "INR") ? "INR" : "USD")}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedAccounts[kind]?.map((account) => {
                const Icon = accountTypeIcons[account.type];
                const inactive = !account.is_active;
                return (
                  <Card
                    key={account.id}
                    className={cn(
                      "transition-colors cursor-pointer group",
                      inactive
                        ? "opacity-50 border-dashed"
                        : "hover:border-[var(--color-accent)]"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          inactive
                            ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
                            : kind === "liability"
                              ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                              : "bg-[var(--color-income)]/10 text-[var(--color-income)]"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[var(--color-text-primary)]">{account.name}</p>
                            {inactive && (
                              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {account.institution} {account.last_four && `••••${account.last_four}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!inactive && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(account); }}
                            className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(account); }}
                          className={cn(
                            "p-1.5 rounded-md text-[var(--color-text-muted)] transition-colors",
                            inactive
                              ? "hover:bg-[var(--color-income)]/10 hover:text-[var(--color-income)]"
                              : "hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                          )}
                          title={inactive ? "Activate" : "Deactivate"}
                        >
                          {inactive ? (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
                              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                            account.is_india_account
                              ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                          )}
                        >
                          {account.is_india_account ? (
                            <><IndianRupee className="h-3 w-3 mr-0.5" />India</>
                          ) : (
                            <>US {accountTypeLabels[account.type]}</>
                          )}
                        </span>
                      </div>
                      <span className={cn(
                        "text-xl font-semibold",
                        inactive ? "text-[var(--color-text-muted)]" : getAccountColor(account.current_balance, kind)
                      )}>
                        {formatCurrency(account.current_balance, account.currency)}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeDeleteDialog} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-[var(--color-danger)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Delete Account?</h3>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              This will deactivate the account. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={closeDeleteDialog} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={isSaving} className="flex-1">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={!isSaving ? closeModal : undefined} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                {editingAccount ? "Edit Account" : "Add Account"}
              </h2>
              <button
                onClick={!isSaving ? closeModal : undefined}
                className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="e.g., Chase Checking"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as AccountType }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="loan">Loan</option>
                    <option value="investment">Investment</option>
                    <option value="retirement">Retirement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Kind
                  </label>
                  <select
                    value={formData.kind}
                    onChange={(e) => setFormData((prev) => ({ ...prev, kind: e.target.value as AccountKind }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Institution
                  </label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) => setFormData((prev) => ({ ...prev, institution: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    placeholder="e.g., Chase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Last Four Digits
                  </label>
                  <input
                    type="text"
                    value={formData.last_four}
                    onChange={(e) => setFormData((prev) => ({ ...prev, last_four: e.target.value }))}
                    maxLength={4}
                    pattern="[0-9]{0,4}"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    placeholder="e.g., 1234"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value as CurrencyCode }))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                    Current Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_balance}
                    onChange={(e) => setFormData((prev) => ({ ...prev, current_balance: e.target.value }))}
                    required
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_india_account"
                  checked={formData.is_india_account}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_india_account: e.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                <label htmlFor="is_india_account" className="text-sm text-[var(--color-text-secondary)]">
                  This is an India account (HDFC, ICICI, etc.)
                </label>
              </div>
              {editingAccount && (
                <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Account Status</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {formData.is_active ? "Active — included in net worth" : "Inactive — excluded from net worth"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                      formData.is_active ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-tertiary)]"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                        formData.is_active ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                {editingAccount && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => openDeleteDialog(editingAccount.id)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                )}
                <div className="flex-1" />
                <Button type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {editingAccount ? "Save Changes" : "Add Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
