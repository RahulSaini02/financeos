"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GridPageSkeleton } from "@/components/ui/skeleton";

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

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // ── profile ──
  const [displayName, setDisplayName] = useState("");
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
  const [payFrequency, setPayFrequency] = useState("biweekly");
  const [filingStatus, setFilingStatus] = useState("single");

  // Seed state from user / localStorage once available
  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name ?? "");
    }
    if (typeof window !== "undefined") {
      const freq = localStorage.getItem("pref_pay_frequency");
      if (freq) setPayFrequency(freq);
      const filing = localStorage.getItem("pref_filing_status");
      if (filing) setFilingStatus(filing);
    }
  }, [user]);

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

  // ── loading state ─────────────────────────────────────────────────────────

  if (authLoading) return <GridPageSkeleton cards={2} />;

  const initials = getInitials(user?.user_metadata?.full_name, user?.email);
  const emailDisplay = user?.email ?? "—";

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Page heading */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              Settings
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
              Manage your account, security, and preferences.
            </p>
          </div>

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
            </div>
          </Card>

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
