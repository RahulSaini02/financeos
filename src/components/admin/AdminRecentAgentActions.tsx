"use client";

import { StatusBadge } from "@/components/ui/status-badge";

interface AgentActionRow {
  tool_name: string;
  status: "pending" | "executed" | "rejected" | "failed";
  executed_at: string | null;
  created_at: string;
  user_email: string;
}

interface AdminRecentAgentActionsProps {
  actions: AgentActionRow[];
}

const statusVariant: Record<AgentActionRow["status"], "success" | "warning" | "danger" | "muted"> = {
  executed: "success",
  pending: "warning",
  failed: "danger",
  rejected: "muted",
};

function formatTimeAgo(executedAt: string | null, createdAt: string | null): string {
  const candidates = [executedAt, createdAt];
  for (const dateStr of candidates) {
    if (!dateStr) continue;
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) continue;
    const diff = Date.now() - time;
    if (diff < 0 || diff > 365 * 86_400_000 * 10) continue;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  return "unknown";
}

export default function AdminRecentAgentActions({ actions }: AdminRecentAgentActionsProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Agent Actions</p>
      </div>

      {actions.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
          No agent actions recorded yet.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-[var(--color-border)]">
            {actions.map((a, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm text-[var(--color-text-primary)] font-mono">
                    {a.tool_name}
                  </p>
                  <StatusBadge label={a.status} variant={statusVariant[a.status]} size="sm" />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span className="truncate mr-2">{a.user_email}</span>
                  <span className="shrink-0">{formatTimeAgo(a.executed_at, a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-medium">Tool</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">User</th>
                <th className="px-4 py-2.5 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-[var(--color-text-primary)]">{a.tool_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={a.status} variant={statusVariant[a.status]} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] truncate max-w-[200px]">
                    {a.user_email}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-muted)]">
                    {formatTimeAgo(a.executed_at, a.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
