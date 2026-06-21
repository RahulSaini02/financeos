"use client";

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export interface AiRequest {
  id: string
  email: string
  full_name: string | null
  ai_access_requested_at: string | null
  ai_access_requested_reason: string | null
}

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
      className="rounded-lg px-4 py-2.5 text-sm font-medium mb-4"
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

export default function AiRequestsPanel({ requests: initialRequests }: { requests: AiRequest[] }) {
  const [requests, setRequests] = useState<AiRequest[]>(initialRequests)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [alert, setAlert] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  async function handleAction(requestId: string, action: 'approve_ai' | 'revoke_ai') {
    setProcessingId(requestId)
    setAlert(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: requestId, action }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Failed to update request')
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
      setAlert({
        kind: 'success',
        message: action === 'approve_ai' ? 'AI access approved.' : 'Request rejected.',
      })
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
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">AI Access Requests</h2>
        {requests.length > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-accent)] text-white font-bold">
            {requests.length} pending
          </span>
        )}
      </div>

      {alert && <InlineAlert kind={alert.kind} message={alert.message} />}

      {requests.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No pending AI access requests.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-tertiary)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {request.email}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Requested: {formatDate(request.ai_access_requested_at)}
                  </p>
                  {request.ai_access_requested_reason && (
                    <div
                      className="mt-2 rounded-lg border p-3"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
                    >
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                        Reason:
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {request.ai_access_requested_reason}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAction(request.id, 'approve_ai')}
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
                    onClick={() => handleAction(request.id, 'revoke_ai')}
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
    </div>
  )
}
