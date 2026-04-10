"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = `toast-${++counterRef.current}`;
      setToasts((prev) => [...prev.slice(-4), { id, kind, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => toast(msg, "success"), [toast]);
  const error = useCallback((msg: string) => toast(msg, "error"), [toast]);
  const info = useCallback((msg: string) => toast(msg, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Toast list ────────────────────────────────────────────────────────────────

const KIND_STYLES: Record<ToastKind, { bg: string; icon: React.ElementType; iconColor: string }> = {
  success: {
    bg: "bg-[var(--color-bg-secondary)] border-[var(--color-success)]/40",
    icon: CheckCircle,
    iconColor: "text-[var(--color-success)]",
  },
  error: {
    bg: "bg-[var(--color-bg-secondary)] border-[var(--color-danger)]/40",
    icon: AlertTriangle,
    iconColor: "text-[var(--color-danger)]",
  },
  info: {
    bg: "bg-[var(--color-bg-secondary)] border-[var(--color-accent)]/40",
    icon: Info,
    iconColor: "text-[var(--color-accent)]",
  },
};

function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => {
        const { bg, icon: Icon, iconColor } = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${bg} animate-in slide-in-from-bottom-2 duration-200`}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
            <p className="flex-1 text-sm text-[var(--color-text-primary)] leading-snug">
              {t.message}
            </p>
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
