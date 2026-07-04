"use client";

import { useCurrency } from "@/lib/currency-context";

export const compactCurrency = (v: number, currency: "USD" | "INR" = "USD") => {
  const symbol = currency === "INR" ? "₹" : "$";
  if (Math.abs(v) >= 1000) return `${symbol}${(Math.abs(v) / 1000).toFixed(0)}k`;
  return `${symbol}${Math.round(Math.abs(v))}`;
};

export interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  const { fmt } = useCurrency();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl text-xs min-w-[140px]">
      <p className="font-semibold text-[var(--color-text-primary)] mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-0.5">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
