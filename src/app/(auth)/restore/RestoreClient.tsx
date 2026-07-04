"use client";

import { useState } from "react";
import { Loader2, ArchiveRestore, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate } from "@/lib/utils";

interface RestoreClientProps {
  deletedAt: string;
  deletionScheduled: string | null;
  windowExpired: boolean;
}

export function RestoreClient({ deletedAt, deletionScheduled, windowExpired }: RestoreClientProps) {
  const supabase = createClient();
  const [restoring, setRestoring] = useState(false);
  const [freshStarting, setFreshStarting] = useState(false);
  const [freshStartConfirmOpen, setFreshStartConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch("/api/user/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to restore account");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore account");
      setRestoring(false);
    }
  }

  async function handleFreshStart() {
    setFreshStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fresh_start" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to delete account data");
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHE" });
      await supabase.auth.signOut();
      window.location.href = "/login?signup=true";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account data");
      setFreshStarting(false);
      setFreshStartConfirmOpen(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center mb-3 shadow-lg shadow-[var(--color-accent)]/30">
            <ArchiveRestore className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Your account was scheduled for deletion on {formatDate(deletedAt)}.
          </p>
        </div>

        <Card>
          <div className="space-y-4">
            {windowExpired ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                The 30-day recovery window has ended and your data is queued for
                permanent removal. You can still start over with a fresh account.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                All your data — transactions, accounts, budgets, goals — is intact
                {deletionScheduled
                  ? ` until ${formatDate(deletionScheduled)}`
                  : " for 30 days from deletion"}
                . Restore your account to pick up right where you left off, or start
                fresh with a clean slate.
              </p>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!windowExpired && (
                <Button onClick={handleRestore} disabled={restoring || freshStarting}>
                  {restoring ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Restoring…
                    </span>
                  ) : (
                    "Restore my account"
                  )}
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => setFreshStartConfirmOpen(true)}
                disabled={restoring || freshStarting}
              >
                Start fresh — delete everything now
              </Button>
            </div>

            <p className="text-xs text-[var(--color-text-muted)]">
              Starting fresh permanently deletes all data immediately and removes this
              account. You can sign up again with the same email afterwards.
            </p>
          </div>
        </Card>

        <ConfirmDialog
          open={freshStartConfirmOpen}
          onClose={() => setFreshStartConfirmOpen(false)}
          onConfirm={handleFreshStart}
          title="Delete everything?"
          description="This permanently deletes all your transactions, accounts, budgets, and every other record — immediately and irreversibly. You'll be signed out and can create a brand-new account."
          confirmLabel="Delete everything"
          loading={freshStarting}
        />
      </div>
    </div>
  );
}
