"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, GripVertical, RotateCcw, CalendarDays, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { HelpModal } from "@/components/ui/help-modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ALL_NAV_ITEMS, NAV_PREFS_KEY, getNavPrefs, type NavPref } from "@/components/ui/app-shell";
import PromptsManager from "./PromptsManager";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

type AlertKind = "success" | "error";

interface InlineAlert {
  kind: AlertKind;
  message: string;
}

function Alert({ alert }: { alert: InlineAlert }) {
  return (
    <div
      className="mt-3 rounded-lg px-4 py-2.5 text-sm font-medium"
      style={{
        background:
          alert.kind === "success"
            ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
            : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
        color:
          alert.kind === "success"
            ? "var(--color-success)"
            : "var(--color-danger)",
        border: `1px solid ${
          alert.kind === "success"
            ? "color-mix(in srgb, var(--color-success) 30%, transparent)"
            : "color-mix(in srgb, var(--color-danger) 30%, transparent)"
        }`,
      }}
    >
      {alert.message}
    </div>
  );
}

// ─── label + input primitives ─────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
      {children}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 focus:ring-offset-[var(--color-bg-primary)] disabled:opacity-50 ${className}`}
      style={{
        background: "var(--color-bg-tertiary)",
        borderColor: "var(--color-border)",
        color: "var(--color-text-primary)",
      }}
      {...props}
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 focus:ring-offset-[var(--color-bg-primary)]"
        style={{
          background: "var(--color-bg-tertiary)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "var(--color-bg-secondary)" }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── section divider ─────────────────────────────────────────────────────────

function Divider() {
  return <hr style={{ borderColor: "var(--color-border)" }} className="my-5" />;
}

// ─── component ────────────────────────────────────────────────────────────────

interface InitialPrompt {
  prompt_key: string;
  content: string;
  version: number;
}

export default function SettingsClient({
  initialName,
  email,
  initialPrompts = [],
}: {
  initialName: string;
  email: string;
  initialPrompts?: InitialPrompt[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { success: toastSuccess, error: toastError } = useToast();

  // ── profile ──
  const [displayName, setDisplayName] = useState(initialName);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAlert, setProfileAlert] = useState<InlineAlert | null>(null);

  // ── password ──
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordAlert, setPasswordAlert] = useState<InlineAlert | null>(null);

  // ── sign-out ──
  const [signingOut, setSigningOut] = useState(false);

  // ── preferences ──
  const [payFrequency, setPayFrequency] = useState<string>(() =>
    (typeof window !== "undefined" && localStorage.getItem("pref_pay_frequency")) || "biweekly"
  );
  const [filingStatus, setFilingStatus] = useState<string>(() =>
    (typeof window !== "undefined" && localStorage.getItem("pref_filing_status")) || "single"
  );
  const [timezone, setTimezone] = useState<string>(() =>
    (typeof window !== "undefined" && localStorage.getItem("pref_timezone")) || "America/Los_Angeles"
  );

  // ── google calendar integration ──
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);
  const [gcalLastSynced, setGcalLastSynced] = useState<string | null>(null);
  const [gcalStatusLoading, setGcalStatusLoading] = useState(true);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [gcalDisconnectConfirm, setGcalDisconnectConfirm] = useState(false);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);

  // ── sidebar nav prefs ──
  // Initialize with server-safe defaults; sync from localStorage after mount to avoid hydration mismatch
  const [navPrefs, setNavPrefs] = useState<NavPref[]>(() =>
    ALL_NAV_ITEMS.map((n) => ({ href: n.href, visible: true }))
  );
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── nav prefs helpers ──────────────────────────────────────────────────────

  function saveNavPrefs(prefs: NavPref[]) {
    localStorage.setItem(NAV_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event("nav-prefs-updated"));
  }

  function toggleNavVisible(href: string) {
    setNavPrefs((prev) => {
      const next = prev.map((p) => (p.href === href ? { ...p, visible: !p.visible } : p));
      saveNavPrefs(next);
      return next;
    });
  }

  const dragIndexRef = useRef<number | null>(null);

  function reorderNavItems(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setNavPrefs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      saveNavPrefs(next);
      return next;
    });
  }

  function resetNavToDefaults() {
    const DEFAULT_HREFS = ["/dashboard", "/accounts", "/transactions", "/budgets", "/categories"];
    const next = ALL_NAV_ITEMS.map((n) => ({ href: n.href, visible: DEFAULT_HREFS.includes(n.href) }));
    setNavPrefs(next);
    saveNavPrefs(next);
  }

  // ── google calendar effects + handlers ───────────────────────────────────

  // Sync nav prefs from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    setNavPrefs(getNavPrefs());
  }, []);

  useEffect(() => {
    // Handle OAuth return query params
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    if (integration === "google_calendar_connected") {
      toastSuccess("Google Calendar connected successfully");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (integration === "google_calendar_error") {
      const reason = params.get("reason");
      toastError(reason ? `Google Calendar error: ${reason}` : "Failed to connect Google Calendar");
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Fetch current connection status
    async function fetchGcalStatus() {
      setGcalStatusLoading(true);
      try {
        const res = await fetch("/api/integrations/google-calendar/status");
        if (res.ok) {
          const data = await res.json() as { connected: boolean; email: string | null; last_synced: string | null };
          setGcalConnected(data.connected);
          setGcalEmail(data.email ?? null);
          setGcalLastSynced(data.last_synced ?? null);
        }
      } catch {
        // silently ignore — status check failure shouldn't block settings page
      } finally {
        setGcalStatusLoading(false);
      }
    }
    fetchGcalStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnectGcal() {
    setGcalConnecting(true);
    try {
      const res = await fetch("/api/integrations/google-calendar/auth");
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to get auth URL");
      window.location.href = data.url!;
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to initiate Google Calendar connection");
      setGcalConnecting(false);
    }
  }

  async function handleSyncGcal() {
    setGcalSyncing(true);
    try {
      const res = await fetch("/api/integrations/google-calendar/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json() as { synced?: number; financial?: number; message?: string };
      const total = data.synced ?? 0;
      const financial = data.financial ?? 0;
      toastSuccess(`Synced ${total} events (${financial} financial)`);
      setGcalLastSynced(new Date().toISOString());
    } catch {
      toastError("Failed to sync Google Calendar");
    } finally {
      setGcalSyncing(false);
    }
  }

  async function handleDisconnectGcal() {
    setGcalDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/google-calendar/status", { method: "DELETE" });
      if (!res.ok) throw new Error("Disconnect failed");
      setGcalConnected(false);
      setGcalEmail(null);
      setGcalLastSynced(null);
      toastSuccess("Google Calendar disconnected");
    } catch {
      toastError("Failed to disconnect Google Calendar");
    } finally {
      setGcalDisconnecting(false);
      setGcalDisconnectConfirm(false);
    }
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileAlert(null);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    setProfileSaving(false);
    if (error) {
      setProfileAlert({ kind: "error", message: error.message });
    } else {
      setProfileAlert({ kind: "success", message: "Profile updated successfully." });
      setTimeout(() => setProfileAlert(null), 4000);
    }
  }

  async function handleChangePassword() {
    setPasswordAlert(null);
    if (!newPassword || newPassword.length < 6) {
      setPasswordAlert({ kind: "error", message: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordAlert({ kind: "error", message: "Passwords do not match." });
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordAlert({ kind: "error", message: error.message });
    } else {
      setPasswordAlert({ kind: "success", message: "Password changed successfully." });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordAlert(null), 4000);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handlePayFrequencyChange(value: string) {
    setPayFrequency(value);
    localStorage.setItem("pref_pay_frequency", value);
  }

  function handleFilingStatusChange(value: string) {
    setFilingStatus(value);
    localStorage.setItem("pref_filing_status", value);
  }

  function handleTimezoneChange(value: string) {
    setTimezone(value);
    localStorage.setItem("pref_timezone", value);
  }

  const initials = getInitials(displayName || initialName, email);
  const emailDisplay = email || "—";

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Page heading */}
        <PageHeader
          title="Settings"
          subtitle="Manage your account, security, and preferences."
          tooltip={
            <HelpModal
              title="Settings"
              description="Customize your FinanceOS experience — set your default currency, theme preference, and manage your profile. Changes here affect the entire app."
              sections={[
                {
                  heading: "How to use",
                  items: [
                    "Update your display name and email in the profile section",
                    "Switch between light and dark theme to match your preference",
                    "Set your default currency (USD or INR) for display purposes",
                    "Sign out from the bottom of the page when you are done",
                  ],
                },
                {
                  heading: "Key actions",
                  items: [
                    "Save profile — update name, email, currency, or theme",
                    "Change password — update your login credentials",
                    "Sign out — end your current session",
                  ],
                },
              ]}
            />
          }
        />

        {/* ── Profile ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {displayName || "No display name set"}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {emailDisplay}
              </p>
            </div>
          </div>

          <Divider />

          {/* Display name */}
          <div className="space-y-4">
            <div>
              <FieldLabel>Display name</FieldLabel>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div>
              <FieldLabel>Email address</FieldLabel>
              <Input value={emailDisplay} readOnly disabled />
              <p className="mt-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                Email cannot be changed here. Contact support if you need to update it.
              </p>
            </div>
          </div>

          {profileAlert && <Alert alert={profileAlert} />}

          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveProfile}
              disabled={profileSaving}
            >
              {profileSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save profile
            </Button>
          </div>
        </Card>

        {/* ── Security ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>

          {/* Change password */}
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Change password
            </p>
            <div>
              <FieldLabel>New password</FieldLabel>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <FieldLabel>Confirm new password</FieldLabel>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
          </div>

          {passwordAlert && <Alert alert={passwordAlert} />}

          <div className="mt-4 flex justify-end">
            <Button
              variant="secondary"
              size="md"
              onClick={handleChangePassword}
              disabled={passwordSaving}
            >
              {passwordSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Update password
            </Button>
          </div>

          <Divider />

          {/* Sign out */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                Sign out
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                You will be redirected to the login page.
              </p>
            </div>
            <Button
              variant="danger"
              size="md"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Sign out
            </Button>
          </div>
        </Card>

        {/* ── Preferences ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>

          <div className="space-y-5">
            <SelectField
              label="Pay frequency"
              value={payFrequency}
              onChange={handlePayFrequencyChange}
              options={[
                { value: "biweekly", label: "Biweekly (every two weeks)" },
                { value: "semi-monthly", label: "Semi-monthly (twice a month)" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <p className="text-xs -mt-2" style={{ color: "var(--color-text-muted)" }}>
              Used by the paycheck and tax estimator modules.
            </p>

            <SelectField
              label="Tax filing status"
              value={filingStatus}
              onChange={handleFilingStatusChange}
              options={[
                { value: "single", label: "Single" },
                { value: "mfj", label: "Married Filing Jointly (MFJ)" },
              ]}
            />
            <p className="text-xs -mt-2" style={{ color: "var(--color-text-muted)" }}>
              Used for federal income tax bracket calculations.
            </p>

            <SelectField
              label="Timezone"
              value={timezone}
              onChange={handleTimezoneChange}
              options={[
                { value: "America/Los_Angeles", label: "Pacific Time (PT) — Los Angeles" },
                { value: "America/Denver", label: "Mountain Time (MT) — Denver" },
                { value: "America/Phoenix", label: "Mountain Time no DST (MST) — Phoenix" },
                { value: "America/Chicago", label: "Central Time (CT) — Chicago" },
                { value: "America/New_York", label: "Eastern Time (ET) — New York" },
                { value: "America/Anchorage", label: "Alaska Time (AKT) — Anchorage" },
                { value: "Pacific/Honolulu", label: "Hawaii Time (HST) — Honolulu" },
                { value: "Asia/Kolkata", label: "India Standard Time (IST) — Kolkata" },
                { value: "UTC", label: "UTC" },
              ]}
            />
            <p className="text-xs -mt-2" style={{ color: "var(--color-text-muted)" }}>
              Used for displaying transaction and date fields across the app.
            </p>
          </div>
        </Card>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Sidebar</CardTitle>
          </CardHeader>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Choose which views appear in the sidebar and reorder them to fit your workflow. Hidden views are never deleted.
          </p>

          <div className="space-y-1">
            {navPrefs.map((pref, idx) => {
              const item = ALL_NAV_ITEMS.find((n) => n.href === pref.href);
              if (!item) return null;
              const Icon = item.icon;
              return (
                <div
                  key={pref.href}
                  draggable
                  onDragStart={() => { dragIndexRef.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDragEnter={() => setDragOverIndex(idx)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverIndex(null);
                    }
                  }}
                  onDrop={() => {
                    setDragOverIndex(null);
                    if (dragIndexRef.current !== null) {
                      reorderNavItems(dragIndexRef.current, idx);
                      dragIndexRef.current = null;
                    }
                  }}
                  onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors cursor-default select-none"
                  style={{
                    background: dragOverIndex === idx
                      ? "color-mix(in srgb, var(--color-accent) 15%, transparent)"
                      : pref.visible ? "var(--color-bg-tertiary)" : "transparent",
                    borderTop: dragOverIndex === idx ? "2px solid var(--color-accent)" : "2px solid transparent",
                    opacity: pref.visible ? 1 : 0.5,
                  }}
                >
                  <GripVertical
                    className="h-4 w-4 shrink-0 cursor-grab active:cursor-grabbing"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  <span className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>
                    {item.label}
                  </span>
                  <button
                    onClick={() => toggleNavVisible(pref.href)}
                    className="p-1 rounded transition-colors hover:bg-[var(--color-bg-secondary)]"
                    aria-label={pref.visible ? "Hide" : "Show"}
                  >
                    {pref.visible ? (
                      <Eye className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                    ) : (
                      <EyeOff className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={resetNavToDefaults}
              className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
              style={{ color: "var(--color-text-muted)" }}
            >
              <RotateCcw className="h-3 w-3" />
              Reset to defaults
            </button>
          </div>
        </Card>

        {/* ── AI Prompts ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>AI Prompts</CardTitle>
          </CardHeader>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Customize the AI prompts used throughout FinanceOS. Changes apply immediately to new AI generations.
          </p>
          <PromptsManager initialPrompts={initialPrompts} />
        </Card>

        {/* ── Integrations ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            Connect external services to extend FinanceOS with automatic syncing and reminders.
          </p>

          {/* Google Calendar */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <CalendarDays className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      Google Calendar
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Sync bill reminders and financial events to your Google Calendar
                    </p>
                  </div>

                  {gcalStatusLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  ) : gcalConnected ? (
                    <div className="flex items-center gap-1.5 text-sm text-emerald-400 shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      Connected
                    </div>
                  ) : null}
                </div>

                {!gcalStatusLoading && gcalConnected && (
                  <div className="mt-3 space-y-3">
                    {gcalEmail && (
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Signed in as <span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>{gcalEmail}</span>
                      </p>
                    )}
                    {gcalLastSynced && (
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Last synced:{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          timeZone: "America/Los_Angeles",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(gcalLastSynced))}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={handleSyncGcal}
                        disabled={gcalSyncing}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-60"
                      >
                        {gcalSyncing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Sync Now
                      </button>
                      <button
                        onClick={() => setGcalDisconnectConfirm(true)}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}

                {!gcalStatusLoading && !gcalConnected && (
                  <div className="mt-3">
                    <button
                      onClick={handleConnectGcal}
                      disabled={gcalConnecting}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-60"
                    >
                      {gcalConnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Connect Google Calendar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <ConfirmDialog
          open={gcalDisconnectConfirm}
          onClose={() => setGcalDisconnectConfirm(false)}
          onConfirm={handleDisconnectGcal}
          title="Disconnect Google Calendar?"
          description="This will remove the connection to your Google Calendar. Bill reminders will no longer sync automatically."
          confirmLabel="Disconnect"
          loading={gcalDisconnecting}
        />

        {/* ── About ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--color-accent)" }}
              >
                F
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  FinanceOS
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Version 1.0.0
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              FinanceOS is your all-in-one personal finance command center. Track accounts,
              categorize transactions, monitor investments, manage loans and subscriptions,
              estimate taxes, and get AI-powered insights — all in one place.
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
}
