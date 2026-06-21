"use client";

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  BrainCircuit,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

export interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'user'
  email_verified: boolean
  ai_enabled: boolean
  ai_access_requested_at: string | null
  ai_access_requested_reason: string | null
  created_at: string
}

type AdminAction = 'approve_ai' | 'revoke_ai' | 'set_admin' | 'set_user' | 'verify_email'

function formatDate(dateString: string | null) {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function InlineAlert({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  return (
    <div
      className="rounded-lg px-4 py-2.5 text-sm font-medium"
      style={{
        background:
          kind === 'success'
            ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
            : 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
        color: kind === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
        border: `1px solid ${
          kind === 'success'
            ? 'color-mix(in srgb, var(--color-success) 30%, transparent)'
            : 'color-mix(in srgb, var(--color-danger) 30%, transparent)'
        }`,
      }}
    >
      {message}
    </div>
  )
}

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
  )
}

function UserRow({
  user,
  processingId,
  onAction,
  onRequestEnableAi,
  onRequestRoleChange,
}: {
  user: AdminUser
  processingId: string | null
  onAction: (userId: string, action: AdminAction) => void
  onRequestEnableAi: (userId: string, email: string) => void
  onRequestRoleChange: (userId: string, email: string, action: 'set_admin' | 'set_user') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isProcessing = processingId === user.id
  const hasPendingRequest = user.ai_access_requested_at !== null && !user.ai_enabled

  return (
    <>
      <tr
        className="border-b transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
          <div className="flex items-center gap-2">
            <span className="truncate max-w-[200px]">{user.email || '—'}</span>
            {hasPendingRequest && user.ai_access_requested_reason && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 text-[var(--color-accent)] hover:opacity-80"
                title="View AI request reason"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </td>

        <td className="px-4 py-3">
          {user.role === 'admin' && user.email === 'sainirahul0802@gmail.com' ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-purple-500/15 text-purple-400">
              <ShieldCheck className="h-3 w-3" />
              owner
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                user.role === 'admin'
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-white/5 text-[var(--color-text-muted)]'
              }`}
            >
              {user.role === 'admin' && <ShieldCheck className="h-3 w-3" />}
              {user.role}
            </span>
          )}
        </td>

        <td className="px-4 py-3">
          {user.email_verified ? (
            <CheckCircle className="h-4 w-4 text-[var(--color-success)]" />
          ) : (
            <XCircle className="h-4 w-4 text-[var(--color-danger)]" />
          )}
        </td>

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

        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {!user.ai_enabled && (
              <button
                onClick={() => onRequestEnableAi(user.id, user.email)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-2 py-1 text-[11px] font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/20 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                {hasPendingRequest ? 'Approve AI' : 'Enable AI'}
              </button>
            )}
            {user.ai_enabled && (
              <button
                onClick={() => onAction(user.id, 'revoke_ai')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Revoke AI
              </button>
            )}
            {user.role === 'user' && user.email !== 'sainirahul0802@gmail.com' && (
              <button
                onClick={() => onRequestRoleChange(user.id, user.email, 'set_admin')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Make Admin
              </button>
            )}
            {user.role === 'admin' && user.email !== 'sainirahul0802@gmail.com' && (
              <button
                onClick={() => onRequestRoleChange(user.id, user.email, 'set_user')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[11px] font-medium text-orange-400 hover:bg-orange-500/20 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Revoke Admin
              </button>
            )}
            {!user.email_verified && (
              <button
                onClick={() => onAction(user.id, 'verify_email')}
                disabled={isProcessing}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                Verify Email
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && hasPendingRequest && user.ai_access_requested_reason && (
        <tr style={{ borderColor: 'var(--color-border)' }}>
          <td colSpan={5} className="px-4 pb-3">
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                AI Access Request Reason
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {user.ai_access_requested_reason}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Requested: {formatDate(user.ai_access_requested_at)}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function UsersTable({ users: initialUsers }: { users: AdminUser[] }) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [usersLoading, setUsersLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [alert, setAlert] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ userId: string; email: string } | null>(null)
  const [roleConfirmTarget, setRoleConfirmTarget] = useState<{
    userId: string
    email: string
    action: 'set_admin' | 'set_user'
  } | null>(null)

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json() as { data?: AdminUser[] }
      setUsers(data.data ?? [])
    } catch {
      setAlert({ kind: 'error', message: 'Failed to load users.' })
    } finally {
      setUsersLoading(false)
    }
  }, [])

  async function handleAction(userId: string, action: AdminAction) {
    setProcessingId(userId)
    setAlert(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to update user')
      }
      const result = await res.json() as { data: Partial<AdminUser> }
      const updated = result.data

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
      )

      const messages: Record<AdminAction, string> = {
        approve_ai: 'AI access approved.',
        revoke_ai: 'AI access revoked.',
        set_admin: 'User promoted to admin.',
        set_user: 'Admin demoted to user.',
        verify_email: 'Email verified.',
      }
      setAlert({ kind: 'success', message: messages[action] })
      setTimeout(() => setAlert(null), 4000)
    } catch (err) {
      setAlert({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to update.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">User Management</h2>
        <Button variant="secondary" size="sm" onClick={fetchUsers} disabled={usersLoading}>
          {usersLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {alert && (
        <div className="mb-4">
          <InlineAlert kind={alert.kind} message={alert.message} />
        </div>
      )}

      {usersLoading && users.length === 0 ? (
        <TableSkeleton />
      ) : users.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No users found.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr
                className="border-b text-[11px] font-semibold uppercase tracking-wider bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Verified</th>
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
                  onRequestEnableAi={(userId, email) => setConfirmTarget({ userId, email })}
                  onRequestRoleChange={(userId, email, action) => setRoleConfirmTarget({ userId, email, action })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="Enable AI Access"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={processingId === confirmTarget?.userId}
              onClick={async () => {
                if (!confirmTarget) return
                const { userId } = confirmTarget
                setConfirmTarget(null)
                await handleAction(userId, 'approve_ai')
              }}
            >
              {processingId === confirmTarget?.userId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Confirm Enable
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
            <BrainCircuit className="h-5 w-5 shrink-0 text-[var(--color-success)]" />
            <p className="text-sm font-medium text-[var(--color-text-primary)] break-all">
              {confirmTarget?.email}
            </p>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            This will grant full access to{' '}
            <strong className="text-[var(--color-text-primary)]">AI Review</strong> and{' '}
            <strong className="text-[var(--color-text-primary)]">AI Chat</strong> for this user.
          </p>
        </div>
      </Modal>

      <Modal
        open={roleConfirmTarget !== null}
        onClose={() => setRoleConfirmTarget(null)}
        title={roleConfirmTarget?.action === 'set_admin' ? 'Promote to Admin?' : 'Revoke Admin Access?'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRoleConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={roleConfirmTarget?.action === 'set_admin' ? 'primary' : 'danger'}
              size="sm"
              disabled={processingId === roleConfirmTarget?.userId}
              onClick={async () => {
                if (!roleConfirmTarget) return
                const { userId, action } = roleConfirmTarget
                setRoleConfirmTarget(null)
                await handleAction(userId, action)
              }}
            >
              {processingId === roleConfirmTarget?.userId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : roleConfirmTarget?.action === 'set_admin' ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  Confirm Promote
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Confirm Revoke
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-400" />
            <p className="text-sm font-medium text-[var(--color-text-primary)] break-all">
              {roleConfirmTarget?.email}
            </p>
          </div>
          {roleConfirmTarget?.action === 'set_admin' ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              This will grant <strong className="text-[var(--color-text-primary)]">full admin access</strong> including user management and system settings.
            </p>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              This will remove admin privileges. The user will lose access to the admin panel and settings.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
