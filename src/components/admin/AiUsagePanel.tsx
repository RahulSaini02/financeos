"use client";

import { DAILY_LIMIT } from "@/lib/ai-rate-limit";

export interface UserUsageRow {
  id: string;
  email: string;
  full_name: string | null;
  today: number;
  week: number;
}

interface Props {
  rows: UserUsageRow[];
  totalToday: number;
  totalWeek: number;
}

export default function AiUsagePanel({ rows, totalToday, totalWeek }: Props) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Calls today", value: totalToday },
          { label: "Calls this week", value: totalWeek },
          { label: "Daily cap / user", value: DAILY_LIMIT },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
          >
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{s.value}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-user table */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Active users</p>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
            No AI calls recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-medium">User</th>
                <th className="px-4 py-2.5 text-right font-medium">Today</th>
                <th className="px-4 py-2.5 text-right font-medium">7 days</th>
                <th className="px-4 py-2.5 text-right font-medium">Daily cap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pct = Math.min((row.today / DAILY_LIMIT) * 100, 100);
                const isNearLimit = row.today >= DAILY_LIMIT * 0.8;
                const isAtLimit = row.today >= DAILY_LIMIT;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {row.full_name ?? row.email}
                      </p>
                      {row.full_name && (
                        <p className="text-xs text-[var(--color-text-muted)]">{row.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          isAtLimit
                            ? "text-[var(--color-danger)]"
                            : isNearLimit
                            ? "text-[var(--color-warning)]"
                            : "text-[var(--color-text-primary)]"
                        }`}
                      >
                        {row.today}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                      {row.week}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              isAtLimit
                                ? "bg-[var(--color-danger)]"
                                : isNearLimit
                                ? "bg-[var(--color-warning)]"
                                : "bg-[var(--color-success)]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)] w-12 text-right">
                          {row.today}/{DAILY_LIMIT}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
