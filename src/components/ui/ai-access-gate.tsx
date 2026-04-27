"use client";

import { useState } from "react";
import { Loader2, BrainCircuit, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/lib/types";

interface AiAccessGateProps {
  userProfile: UserProfile | null;
  children: React.ReactNode;
}

export function AiAccessGate({ userProfile, children }: AiAccessGateProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI is enabled — render children as-is
  if (userProfile?.ai_enabled) {
    return <>{children}</>;
  }

  // Request already submitted (either from DB or just now)
  const hasPendingRequest =
    submitted || (userProfile?.ai_access_requested_at !== null && userProfile?.ai_access_requested_at !== undefined);

  if (hasPendingRequest) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10">
            <Clock className="h-7 w-7 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Request Under Review
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              Your AI access request is under review. You&apos;ll be notified when it&apos;s
              approved.
            </p>
          </div>
          <div
            className="rounded-xl border px-4 py-3 text-left"
            style={{
              borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)",
              background: "var(--color-bg-tertiary)",
            }}
          >
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              If you need urgent access, contact an admin directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No request yet — show request form
  const isValid = reason.trim().length >= 20;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/user-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit request");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Icon + heading */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10">
            <Lock className="h-7 w-7 text-[var(--color-accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
              AI Access Required
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              FinanceOS AI features are gated. Submit a request to get access and unlock AI-powered
              insights, chat, and analysis.
            </p>
          </div>
        </div>

        {/* Feature preview */}
        <div
          className="rounded-xl border p-4 space-y-2"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-bg-tertiary)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            What you&apos;ll unlock
          </p>
          <div className="space-y-2">
            {[
              "AI Finance Assistant — chat with your financial data",
              "Monthly AI Review — deep spending & trend analysis",
              "Auto-categorization — smart transaction labeling",
              "Daily insights — personalized financial summaries",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shrink-0" />
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {feature}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Request form */}
        <div
          className="rounded-xl border p-4 space-y-4"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-bg-secondary)",
          }}
        >
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              Request Access
            </p>
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Why do you want AI access?
              <span className="ml-1" style={{ color: "var(--color-text-muted)" }}>
                (minimum 20 characters)
              </span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe how you plan to use AI features in FinanceOS..."
              rows={4}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none transition-colors focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 focus:ring-offset-[var(--color-bg-primary)]"
              style={{
                background: "var(--color-bg-tertiary)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            />
            <p
              className="mt-1 text-right text-xs"
              style={{
                color:
                  reason.trim().length > 0 && reason.trim().length < 20
                    ? "var(--color-danger)"
                    : "var(--color-text-muted)",
              }}
            >
              {reason.trim().length} / 20 min
            </p>
          </div>

          {error && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                color: "var(--color-danger)",
                border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              }}
            >
              {error}
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
