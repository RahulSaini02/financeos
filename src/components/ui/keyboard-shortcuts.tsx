"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS: { key: string; description: string; action?: () => void; href?: string }[] = [
  { key: "D", description: "Go to Dashboard", href: "/dashboard" },
  { key: "T", description: "Go to Transactions", href: "/transactions" },
  { key: "A", description: "Go to Accounts", href: "/accounts" },
  { key: "B", description: "Go to Budgets", href: "/budgets" },
  { key: "L", description: "Go to Loans", href: "/loans" },
  { key: "I", description: "Go to Investments", href: "/investments" },
  { key: "S", description: "Go to Settings", href: "/settings" },
  { key: "?", description: "Show keyboard shortcuts" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't trigger when typing in inputs / textareas / selects
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toUpperCase();

      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      const match = SHORTCUTS.find((s) => s.key === key && s.href);
      if (match?.href) {
        e.preventDefault();
        router.push(match.href);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => setShowHelp(false)} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button onClick={() => setShowHelp(false)} className="rounded-lg p-1 hover:bg-[var(--color-bg-tertiary)]">
            <X className="h-4 w-4 text-[var(--color-text-muted)]" />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{s.description}</span>
              <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1.5 text-xs font-mono text-[var(--color-text-muted)]">
                {s.key}
              </kbd>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)] mt-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Close help</span>
            <kbd className="inline-flex h-6 min-w-10 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1.5 text-xs font-mono text-[var(--color-text-muted)]">Esc</kbd>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
          Press <kbd className="inline-flex h-5 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-1 text-xs font-mono">?</kbd> anytime to toggle this panel.
        </p>
      </div>
    </div>
  );
}
