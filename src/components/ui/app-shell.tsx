"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PieChart,
  Landmark,
  CreditCard,
  TrendingUp,
  FileText,
  Briefcase,
  ArrowRightLeft,
  Upload,
  Settings,
  Target,
  Repeat,
  Tag,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingAiChat } from "@/components/ui/floating-ai-chat";
import { KeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { useAuth } from "@/components/auth-provider";

export const ALL_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/savings-goals", label: "Savings Goals", icon: Target },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/loans", label: "Loans", icon: Landmark },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/paychecks", label: "Paychecks", icon: FileText },
  { href: "/employers", label: "Employers", icon: Briefcase },
  { href: "/tax-estimator", label: "Taxes", icon: ArrowRightLeft },
  { href: "/ai-review", label: "AI Review", icon: Sparkles },
  { href: "/import", label: "Import", icon: Upload },
];

export const NAV_PREFS_KEY = "pref_nav_items";

export interface NavPref {
  href: string;
  visible: boolean;
}

export function getNavPrefs(): NavPref[] {
  if (typeof window === "undefined") return ALL_NAV_ITEMS.map((n) => ({ href: n.href, visible: true }));
  try {
    const stored = localStorage.getItem(NAV_PREFS_KEY);
    if (!stored) return ALL_NAV_ITEMS.map((n) => ({ href: n.href, visible: true }));
    const parsed: NavPref[] = JSON.parse(stored);
    // Validate each entry, merge any new items added since user saved prefs
    const knownHrefs = new Set(parsed.map((p) => p.href));
    const validParsed = parsed.filter((p) => ALL_NAV_ITEMS.some((n) => n.href === p.href));
    const newItems = ALL_NAV_ITEMS.filter((n) => !knownHrefs.has(n.href)).map((n) => ({ href: n.href, visible: true }));
    return [...validParsed, ...newItems];
  } catch {
    return ALL_NAV_ITEMS.map((n) => ({ href: n.href, visible: true }));
  }
}

// Bottom nav shows 5 most-used items on mobile (always fixed)
const bottomNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Txns", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/ai-review", label: "AI", icon: Sparkles },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navPrefs, setNavPrefs] = useState<NavPref[]>(() => ALL_NAV_ITEMS.map((n) => ({ href: n.href, visible: true })));

  // Load nav prefs from localStorage on mount
  useEffect(() => {
    setNavPrefs(getNavPrefs());
    // Listen for storage changes (e.g., settings page updates prefs)
    function handleStorage(e: StorageEvent) {
      if (e.key === NAV_PREFS_KEY) setNavPrefs(getNavPrefs());
    }
    window.addEventListener("storage", handleStorage);
    // Also listen for a custom event (same-tab updates)
    function handleNavUpdate() { setNavPrefs(getNavPrefs()); }
    window.addEventListener("nav-prefs-updated", handleNavUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("nav-prefs-updated", handleNavUpdate);
    };
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const displayName: string =
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "User";

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Build ordered, filtered nav items from prefs
  const visibleNavItems = navPrefs
    .filter((p) => p.visible)
    .map((p) => ALL_NAV_ITEMS.find((n) => n.href === p.href))
    .filter(Boolean) as typeof ALL_NAV_ITEMS;

  const sidebar = (
    <aside className="flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] h-full">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
        <span className="text-lg font-semibold tracking-tight">FinanceOS</span>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden -mr-1 p-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--color-border)] p-2">
        <Link
          href="/settings"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/80 text-xs font-medium text-white shrink-0">
            {initials}
          </div>
          <span className="flex-1 truncate text-left font-medium">{displayName}</span>
          <Settings className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Link>
      </div>
    </aside>
  );

  // Don't show sidebar until auth resolves, or if user is not authenticated
  if (isLoading || !user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* ── Desktop sidebar ───────────────────────── */}
      <div className="hidden lg:flex lg:shrink-0">
        {sidebar}
      </div>

      {/* ── Mobile: Backdrop ─────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: Slide-in sidebar drawer ─────── */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </div>

      {/* ── Right side: top bar + content ────────── */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold tracking-tight">FinanceOS</span>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-medium text-white">
            {initials}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation ──────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] lg:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-0 flex-1 transition-colors",
                  isActive
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <FloatingAiChat />
      <KeyboardShortcuts />
    </div>
  );
}
