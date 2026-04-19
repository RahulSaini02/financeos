"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  BrainCircuit,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  role: "admin" | "user";
  email_verified: boolean;
  ai_enabled: boolean;
  ai_access_requested_at: string | null;
  ai_access_requested_reason: string | null;
  created_at: string;
}

interface AdminStats {
  totalUsers: number;
  pendingAiAccess: number;
  approvedAiAccess: number;
}

type AdminAction = "approve_ai" | "revoke_ai" | "set_admin" | "verify_email";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

// ── Inline Alert ───────────────────────────────────────────────────────────────

function InlineAlert({ kind, message }: { kind: "success" | "error"; message: string }) {
  return (
    <div
      className="rounded-lg px-4 py-2.5 text-sm font-medium"
      style={{
        background:
          kind === "success"
            ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
            : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
        color: kind === "success" ? "var(--color-success)" : "var(--color-danger)",
        border: `1px solid ${
          kind === "success"
            ? "color-mix(in srgb, var(--color-success) 30%, transparent)"
            : "color-mix(in srgb, var(--color-danger) 30%, transparent)"
        }`,
      }}
    >
      {message}
    </div>
  );
}

// ── User Row ───────────────────────────────────────────────────────────────────

function UserRow({
  user,
  processingId,
  onAction,
}: {
  user: AdminUser;
  processingId: string | null;
  onAction: (userId: string, action: AdminAction) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isProcessing = processingId === user.id;
  const hasPendingRequest =
    user.ai_access_requested_at !== null && !user.ai_enabled;

  return (
    <>
      <tr
        className="border-b transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Email */}
        <td className="px-4 py-3 text-sm" style={{ color: "var(--color-text-primary)" }}>
          <div className="flex items-center gap-2">
            <span className="truncate max-w-[200px]">{user.email || "—"}</span>
            {hasPendingRequest && user.ai_access_requested_reason && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 text-[var(--color-accent)] hover:opacity-80"
                title="View AI request reason"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </td>

        {/* Role */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              user.role === "admin"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-white/5 text-[var(--color-text-muted)]"
            }`}
          >
            {user.role === "admin" && <ShieldCheck className="h-3 w-3" />}
            {user.role}
          </span>
        </td>

        {/* Email Verified */}
        <td className="px-4 py-3">
          {user.email_verified ? (
            <CheckCircle className="h-4 w-4 text-[var(--color-success)]" />
          ) : (
            <XCircle className="h-4 w-4 text-[var(--color-danger)]" />
          )}
        </td>

        {/* AI Enabled */}
        <td className="px-4 py-3">
          {user.ai_enabled ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-success)]">
              <CheckCircle className="h-3.5 w-3.5" /> Enabled
            </span>
          ) : hasPendingRequest ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
              <Clock className="h-3.5 w-3.5" /> Pending
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
              <XCircle className="h-3.5 w-3.5" /> Disabled
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {!user.ai_enabled && hasPendingRequest && (
              <button
                onClick={() => onAction(user.id, "approve_ai")}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-2 py-1 text-[11px] font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/20 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                Approve AI
              </button>
            )}
            {user.ai_enabled && (
              <button
                onClick={() => onAction(user.id, "revoke_ai")}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                Revoke AI
              </button>
            )}
            {user.role === "user" && (
              <button
                onClick={() => onAction(user.id, "set_admin")}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3 w-3" />
                )}
                Make Admin
              </button>
            )}
            {!user.email_verified && (
              <button
                onClick={() => onAction(user.id, "verify_email")}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <UserCheck className="h-3 w-3" />
                )}
                Verify Email
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded reason row */}
      {expanded && hasPendingRequest && user.ai_access_requested_reason && (
        <tr style={{ borderColor: "var(--color-border)" }}>
          <td
            colSpan={5}
            className="px-4 pb-3"
          >
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: "var(--color-border)", background: "var(--color-bg-tertiary)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>
                AI Access Request Reason
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {user.ai_access_requested_reason}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Requested: {formatDate(user.ai_access_requested_at)}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center px-4 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminClient({
  userEmail,
  stats: initialStats,
  aiRequests: initialAiRequests,
}: {
  userEmail: string;
  stats: AdminStats;
  aiRequests: Array<{
    id: string;
    email: string;
    full_name: string | null;
    ai_access_requested_at: string | null;
    ai_access_requested_reason: string | null;
  }>;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "ai-requests" | "models">("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Compute stats from users list once loaded, else use server-side stats
  const stats: AdminStats = users.length > 0
    ? {
        totalUsers: users.length,
        pendingAiAccess: users.filter((u) => !u.ai_enabled && u.ai_access_requested_at !== null).length,
        approvedAiAccess: users.filter((u) => u.ai_enabled).length,
      }
    : initialStats;

  const pendingRequests = users.length > 0
    ? users.filter((u) => !u.ai_enabled && u.ai_access_requested_at !== null)
    : initialAiRequests.map((r) => ({
        id: r.id,
        email: r.email,
        role: "user" as const,
        email_verified: false,
        ai_enabled: false,
        ai_access_requested_at: r.ai_access_requested_at,
        ai_access_requested_reason: r.ai_access_requested_reason,
        created_at: "",
      }));

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.data ?? []);
    } catch {
      setAlert({ kind: "error", message: "Failed to load users." });
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Fetch users when switching to users or ai-requests tab
  useEffect(() => {
    if ((activeTab === "users" || activeTab === "ai-requests") && users.length === 0) {
      fetchUsers();
    }
  }, [activeTab, fetchUsers, users.length]);

  async function handleAction(userId: string, action: AdminAction) {
    setProcessingId(userId);
    setAlert(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update user");
      }
      const result = await res.json();
      const updated = result.data;

      // Merge update into local users list
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: updated.role ?? u.role,
                email_verified: updated.email_verified ?? u.email_verified,
                ai_enabled: updated.ai_enabled ?? u.ai_enabled,
                ai_access_requested_at: updated.ai_access_requested_at ?? u.ai_access_requested_at,
              }
            : u
        )
      );

      const messages: Record<AdminAction, string> = {
        approve_ai: "AI access approved.",
        revoke_ai: "AI access revoked.",
        set_admin: "User promoted to admin.",
        verify_email: "Email verified.",
      };
      setAlert({ kind: "success", message: messages[action] });
      setTimeout(() => setAlert(null), 4000);
    } catch (err) {
      setAlert({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to update.",
      });
    } finally {
      setProcessingId(null);
    }
  }

  const adminUsers = users.filter((u) => u.role === "admin").length;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "users" as const, label: "User Management" },
    {
      key: "ai-requests" as const,
      label: "AI Requests",
      badge: stats.pendingAiAccess > 0 ? stats.pendingAiAccess : null,
    },
    { key: "models" as const, label: "AI Models" },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Admin Panel"
          subtitle="System administration and user management."
        />

        {alert && <InlineAlert kind={alert.kind} message={alert.message} />}

        {/* Tabs */}
        <div
          className="flex gap-1 border-b overflow-x-auto"
          style={{ borderColor: "var(--color-border)" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                color:
                  activeTab === tab.key
                    ? "var(--color-accent)"
                    : "var(--color-text-secondary)",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid var(--color-accent)"
                    : "2px solid transparent",
              }}
            >
              {tab.label}
              {tab.badge != null && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--color-accent)] text-white font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Users",
                  value: stats.totalUsers,
                  icon: Users,
                  colorClass: "text-[var(--color-accent)]",
                  bgClass: "bg-[var(--color-accent)]/10",
                },
                {
                  label: "AI Enabled",
                  value: stats.approvedAiAccess,
                  icon: BrainCircuit,
                  colorClass: "text-[var(--color-success)]",
                  bgClass: "bg-[var(--color-success)]/10",
                },
                {
                  label: "Pending Requests",
                  value: stats.pendingAiAccess,
                  icon: Clock,
                  colorClass: "text-amber-400",
                  bgClass: "bg-amber-400/10",
                },
                {
                  label: "Admin Users",
                  value: users.length > 0 ? adminUsers : "—",
                  icon: ShieldCheck,
                  colorClass: "text-blue-400",
                  bgClass: "bg-blue-400/10",
                },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stat.bgClass}`}
                      >
                        <stat.icon className={`h-4 w-4 ${stat.colorClass}`} />
                      </div>
                      <div>
                        <p
                          className="text-xl font-bold"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {stat.value}
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {stat.label}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Admin session */}
            <Card>
              <CardHeader>
                <CardTitle>Admin Session</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
                  <Shield className="h-4 w-4 text-[var(--color-accent)]" />
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Logged in as Admin
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {userEmail}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── User Management Tab ───────────────────────────────────────────── */}
        {activeTab === "users" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>User Management</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={usersLoading}
                >
                  {usersLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
            </CardHeader>

            {usersLoading && users.length === 0 ? (
              <TableSkeleton />
            ) : users.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                No users found.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-5">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr
                      className="border-b text-[11px] font-semibold uppercase tracking-wider"
                      style={{
                        borderColor: "var(--color-border)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Role</th>
                      <th className="px-4 py-2.5">Email Verified</th>
                      <th className="px-4 py-2.5">AI Access</th>
                      <th className="px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        processingId={processingId}
                        onAction={handleAction}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── AI Access Requests Tab ─────────────────────────────────────────── */}
        {activeTab === "ai-requests" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>
                  AI Access Requests
                </CardTitle>
                {stats.pendingAiAccess > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-accent)] text-white font-bold">
                    {stats.pendingAiAccess} pending
                  </span>
                )}
              </div>
            </CardHeader>

            {usersLoading && pendingRequests.length === 0 ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                No pending AI access requests.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: "var(--color-border)",
                      background: "var(--color-bg-tertiary)",
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--color-text-primary)" }}
                          >
                            {request.email}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium">
                            Pending
                          </span>
                        </div>
                        <p className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>
                          Requested: {formatDate(request.ai_access_requested_at)}
                        </p>
                        {request.ai_access_requested_reason && (
                          <div
                            className="mt-2 rounded-lg border p-3"
                            style={{
                              borderColor: "var(--color-border)",
                              background: "var(--color-bg-secondary)",
                            }}
                          >
                            <p
                              className="text-xs font-medium mb-1"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              Reason:
                            </p>
                            <p
                              className="text-sm leading-relaxed"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {request.ai_access_requested_reason}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAction(request.id, "approve_ai")}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleAction(request.id, "revoke_ai")}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── AI Models Tab ──────────────────────────────────────────────────── */}
        {activeTab === "models" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
                  <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
                </div>
                <CardTitle>AI Model Configuration</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Default AI models configured per feature. Users can override their chat model
                preference from Settings.
              </p>
              <div
                className="rounded-xl border divide-y"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-bg-tertiary)",
                }}
              >
                {[
                  { label: "Daily Insight", desc: "Dashboard daily insight card", model: "claude-haiku-4-5-20251001" },
                  { label: "Monthly Summary", desc: "Monthly AI summary generation", model: "claude-haiku-4-5-20251001" },
                  { label: "AI Review", desc: "Monthly review analysis", model: "claude-sonnet-4-6" },
                  { label: "Auto-Categorization", desc: "Transaction categorization", model: "claude-haiku-4-5-20251001" },
                  { label: "AI Chat", desc: "Chat assistant (user-configurable)", model: "claude-sonnet-4-6" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-4 py-3 gap-4"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {item.label}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {item.desc}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs px-2 py-1 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-mono">
                      {item.model}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                To change default models, update the values in the codebase. Users can set per-prompt
                model overrides in Settings &rarr; AI Prompts.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
