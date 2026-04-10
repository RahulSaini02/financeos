"use client";

import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";

interface InfoTooltipProps {
  title: string;
  description: string;
  howTo?: string;
  keyActions?: string[];
}

export function InfoTooltip({ title, description, howTo, keyActions }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center h-5 w-5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        aria-label="Toggle page info"
        aria-pressed={open}
        aria-controls="info-tooltip-popup"
      >
        <Info className="h-4 w-4" />
      </button>

      {open && (
        <div
          id="info-tooltip-popup"
          role="dialog"
          aria-modal="false"
          aria-labelledby="info-tooltip-title"
          className="absolute left-0 top-7 z-50 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xl p-4"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 id="info-tooltip-title" className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{description}</p>

          {howTo && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1">How to use</p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{howTo}</p>
            </div>
          )}

          {keyActions && keyActions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Key actions</p>
              <ul className="space-y-1">
                {keyActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
