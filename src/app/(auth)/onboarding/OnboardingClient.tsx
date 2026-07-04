"use client";

import { useState } from "react";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ALL_NAV_ITEMS, NAV_PREFS_KEY } from "@/components/ui/app-shell";
import {
  PERSONA_OPTIONS,
  TRACKING_OPTIONS,
  PERSONA_PREF_KEY,
  defaultVisibleHrefs,
} from "@/lib/persona-nav";
import type { Persona, TrackingScope } from "@/lib/types";

export function OnboardingClient({ userId }: { userId: string }) {
  const supabase = createClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scope, setScope] = useState<TrackingScope | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(selectedScope: TrackingScope | null, skipped: boolean) {
    setSaving(true);
    setError(null);
    try {
      const chosenPersona: Persona = skipped ? "other" : (persona ?? "other");
      const chosenScope: TrackingScope = skipped ? "full" : (selectedScope ?? "full");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          persona: chosenPersona,
          tracking_scope: chosenScope,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (updateError) throw new Error(updateError.message);

      // Seed the same nav prefs the Settings show/hide panel edits — never locked.
      localStorage.setItem(PERSONA_PREF_KEY, chosenPersona);
      const visible = defaultVisibleHrefs(chosenPersona, chosenScope);
      if (visible) {
        const prefs = ALL_NAV_ITEMS.map((n) => ({
          href: n.href,
          visible: visible.has(n.href) || n.href === "/admin", // admin stays role-gated
        }));
        localStorage.setItem(NAV_PREFS_KEY, JSON.stringify(prefs));
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-bg-primary)] px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center mb-3 shadow-lg shadow-[var(--color-accent)]/30">
            <span className="text-white font-bold text-xl tracking-tight">F</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === 1 ? "What describes you best?" : "What do you want to track?"}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {step === 1
              ? "We'll tailor your sidebar to fit — you can change every tab later in Settings."
              : "This just picks your starting tabs. Nothing is locked, no data is hidden forever."}
          </p>
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-[var(--color-danger)]">{error}</p>
        )}

        {step === 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PERSONA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPersona(opt.value);
                  setStep(2);
                }}
                className={`text-left rounded-xl border p-4 transition-colors hover:border-[var(--color-accent)] ${
                  persona === opt.value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {TRACKING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={saving}
                onClick={() => {
                  setScope(opt.value);
                  void finish(opt.value, false);
                }}
                className={`w-full text-left rounded-xl border p-4 transition-colors hover:border-[var(--color-accent)] disabled:opacity-60 ${
                  scope === opt.value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span>
                    <span className="block text-sm font-semibold">{opt.label}</span>
                    <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                      {opt.description}
                    </span>
                  </span>
                  {saving && scope === opt.value ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
                  ) : scope === opt.value ? (
                    <Check className="h-4 w-4 text-[var(--color-accent)]" />
                  ) : null}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={saving}
              className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mt-2"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => void finish(null, true)} disabled={saving}>
            Skip — show me everything
          </Button>
        </div>
      </div>
    </div>
  );
}
