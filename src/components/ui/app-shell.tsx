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
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  BrainCircuit,
  Settings2,
  BellRing,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
const FloatingAiChat = dynamic(
  () => import("@/components/ui/floating-ai-chat").then((m) => m.FloatingAiChat),
  { ssr: false }
);
const AppTour = dynamic(
  () => import("@/components/ui/app-tour").then((m) => m.AppTour),
  { ssr: false }
);
import { KeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { GlobalSearch } from "@/components/ui/global-search";
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
  { href: "/subscriptions", label: "Bills & Subs", icon: CreditCard },
  { href: "/paychecks", label: "Paychecks", icon: FileText },
  { href: "/employers", label: "Employers", icon: Briefcase },
  { href: "/tax-estimator", label: "Taxes", icon: ArrowRightLeft },
  { href: "/ai-review", label: "AI Review", icon: Sparkles },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
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

const adminBottomNavItems = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/ai-requests", label: "AI Usage", icon: BrainCircuit },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

interface AppShellProps {
  children: React.ReactNode;
}

const IS_DEV = process.env.NODE_ENV === "development";

function DevPushMobileButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function send() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <button
      onClick={send}
      title="Dev: send test push notification"
      className={cn(
        "p-1.5 rounded-lg transition-colors",
        status === "sent"
          ? "text-[var(--color-success)]"
          : status === "error"
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
      )}
    >
      {status === "loading" ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <BellRing className="h-5 w-5" />
      )}
    </button>
  );
}

function DevPushButton({ collapsed }: { collapsed?: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function send() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <button
      onClick={send}
      title="Dev: send test push notification"
      className={cn(
        "flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors",
        collapsed ? "justify-center" : "gap-3 px-3",
        status === "sent"
          ? "text-[var(--color-success)]"
          : status === "error"
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
        "border border-dashed border-[var(--color-border)]"
      )}
    >
      {status === "loading" ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <BellRing className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && (
        <span className="truncate text-xs">
          {status === "sent" ? "Sent!" : status === "error" ? "Failed" : "Test Push"}
        </span>
      )}
    </button>
  );
}

const SIDEBAR_COLLAPSED_KEY = "pref_sidebar_collapsed";
const PUSH_DISMISSED_KEY = "push_prompt_dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function PushPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (localStorage.getItem(PUSH_DISMISSED_KEY)) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!sub) setVisible(true); })
      .catch(() => {});
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(PUSH_DISMISSED_KEY, "1");
  }

  async function handleEnable() {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { dismiss(); return; }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const vapidRes = await fetch("/api/push/vapid-key");
      const vapidData = await vapidRes.json() as { publicKey?: string };
      if (!vapidData.publicKey) { dismiss(); return; }

      const keyBytes = urlBase64ToUint8Array(vapidData.publicKey);
      if (keyBytes.length !== 65) { dismiss(); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer as ArrayBuffer,
      });

      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });
    } catch (err) {
      console.error("Push auto-subscribe error:", err);
    } finally {
      setSubscribing(false);
      dismiss();
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[4.5rem] lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 z-50 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <BellRing className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Enable notifications</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
            Get bill reminders and spending alerts
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleEnable}
          disabled={subscribing}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {subscribing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {subscribing ? "Enabling…" : "Enable"}
        </button>
        <button
          onClick={dismiss}
          className="px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors rounded-lg"
        >
          Later
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [navPrefs, setNavPrefs] = useState<NavPref[]>(() => getNavPrefs());
  const [isAdmin, setIsAdmin] = useState(false);
  // tourDismissed tracks whether the user has seen (or skipped) the tour.
  // Initialised from localStorage so it persists across page refreshes.
  const [tourDismissed, setTourDismissed] = useState(() => {
    try { return !!localStorage.getItem("has_seen_tour"); } catch { return false; }
  });
  // Derived — no setState needed in an effect
  const showTour = pathname === "/dashboard" && !tourDismissed;

  // Listen for tour-complete and start-tour custom events
  useEffect(() => {
    function onTourComplete() { setTourDismissed(true); }
    function onStartTour() { setTourDismissed(false); }
    window.addEventListener("tour-complete", onTourComplete);
    window.addEventListener("start-tour", onStartTour);
    return () => {
      window.removeEventListener("tour-complete", onTourComplete);
      window.removeEventListener("start-tour", onStartTour);
    };
  }, []);

  // Listen for nav pref changes from other tabs / same-tab updates
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === NAV_PREFS_KEY) setNavPrefs(getNavPrefs());
    }
    function handleNavUpdate() { setNavPrefs(getNavPrefs()); }
    window.addEventListener("storage", handleStorage);
    window.addEventListener("nav-prefs-updated", handleNavUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("nav-prefs-updated", handleNavUpdate);
    };
  }, []);

  // Fetch user profile to determine admin status (for Admin nav item)
  useEffect(() => {
    if (!user) return;
    fetch("/api/user-profile")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.data?.role === "admin") setIsAdmin(true);
      })
      .catch(() => { /* ignore */ });
  }, [user]);

  const toggleCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Close sidebar on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  // Admin item only shows for admin users
  const visibleNavItems = navPrefs
    .filter((p) => p.visible)
    .filter((p) => p.href !== "/admin" || isAdmin)
    .map((p) => ALL_NAV_ITEMS.find((n) => n.href === p.href))
    .filter(Boolean) as typeof ALL_NAV_ITEMS;

  // Mobile sidebar — always fully expanded
  const mobileSidebar = (
    <aside
      className="flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] h-full"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)" }}
    >
      <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
        <span className="text-lg font-semibold tracking-tight">FinanceOS</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="-mr-1 p-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${item.href.replace("/", "")}`}
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
      <div className="border-t border-[var(--color-border)] p-2">
        <Link
          href="/settings"
          data-tour="nav-settings"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-700 text-xs font-medium text-white shrink-0">
            {initials}
          </div>
          <span className="flex-1 truncate text-left font-medium">{displayName}</span>
          <Settings className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Link>
      </div>
    </aside>
  );

  // Desktop sidebar — collapsible
  const desktopSidebar = (
    <aside
      className={cn(
        "flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] h-full overflow-hidden",
        "transition-[width] duration-300 ease-in-out",
        sidebarCollapsed ? "w-14" : "w-64"
      )}
    >
      {/* Logo / collapse toggle */}
      <div className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-2">
        {!sidebarCollapsed && (
          <span className="flex-1 truncate pl-1 text-lg font-semibold tracking-tight">FinanceOS</span>
        )}
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors",
            sidebarCollapsed && "mx-auto"
          )}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-3">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${item.href.replace("/", "")}`}
              title={sidebarCollapsed ? item.label : undefined}
              aria-label={sidebarCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                sidebarCollapsed ? "justify-center" : "gap-3 px-3",
                isActive
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--color-border)] p-2 space-y-1">
        {IS_DEV && <DevPushButton collapsed={sidebarCollapsed} />}
        <Link
          href="/settings"
          data-tour="nav-settings"
          title={sidebarCollapsed ? displayName : undefined}
          aria-label={sidebarCollapsed ? `${displayName} — Settings` : undefined}
          className={cn(
            "flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors",
            sidebarCollapsed ? "justify-center" : "gap-3 px-3",
            pathname === "/settings"
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-xs font-medium text-white">
            {initials}
          </div>
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 truncate text-left font-medium">{displayName}</span>
              <Settings className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </>
          )}
        </Link>
      </div>
    </aside>
  );

  // Don't show sidebar on auth pages, while loading, or if unauthenticated
  const isAuthPage = pathname === "/login";
  if (isLoading || !user || isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* ── Desktop sidebar ───────────────────────── */}
      <div className="hidden lg:flex lg:shrink-0">
        {desktopSidebar}
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
        {mobileSidebar}
      </div>

      {/* ── Right side: top bar + content ────────── */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* Mobile top bar */}
        <header
          className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] lg:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold tracking-tight">FinanceOS</span>
          <div className="flex items-center gap-1">
            {IS_DEV && <DevPushMobileButton />}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-700 text-xs font-medium text-white">
              {initials}
            </div>
          </div>
        </div>
        </header>

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto lg:pb-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem)" }}
        >
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation ──────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {(pathname?.startsWith("/admin") ? adminBottomNavItems : bottomNavItems).map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-0 flex-1 transition-colors",
                  isActive
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AppTour startTour={showTour} />
      <FloatingAiChat />
      <KeyboardShortcuts />
      <GlobalSearch />
      <PushPromptBanner />
    </div>
  );
}
