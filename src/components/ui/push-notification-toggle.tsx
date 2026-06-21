'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

interface PushNotificationToggleProps {
  className?: string
  showLabel?: boolean
}

export function PushNotificationToggle({ className, showLabel }: PushNotificationToggleProps) {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isSupported =
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    setSupported(isSupported)
    if (!isSupported) {
      setChecking(false)
      return
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setSubscribed(!!sub)
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  const handleToggle = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setSubscribed(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setError('Notification permission denied')
          return
        }

        // Clear any stale subscription from a previous VAPID key
        const existingSub = await reg.pushManager.getSubscription()
        if (existingSub) {
          await existingSub.unsubscribe()
        }

        // Fetch VAPID public key from server
        const vapidRes = await fetch('/api/push/vapid-key')
        const { publicKey } = (await vapidRes.json()) as { publicKey: string }
        if (!publicKey) {
          setError('Push not configured on server')
          return
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        })

        const subJson = sub.toJSON() as {
          endpoint: string
          keys: { p256dh: string; auth: string }
        }
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subJson),
        })
        setSubscribed(true)
      }
    } catch (err) {
      console.error('Push toggle error:', err)
      const isLocalhost = window.location.hostname === 'localhost'
      if (isLocalhost && err instanceof DOMException && err.name === 'AbortError') {
        setError('Push notifications require HTTPS — deploy to test')
      } else {
        setError('Failed to register — check browser notification settings')
      }
    } finally {
      setLoading(false)
    }
  }, [subscribed, loading])

  if (!supported || checking) return null

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={loading}
        title={
          subscribed
            ? 'Notifications on — click to disable'
            : 'Enable push notifications'
        }
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
          subscribed
            ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
        } ${className ?? ''}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : subscribed ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
        {showLabel && (
          <span>{subscribed ? 'Notifications on' : 'Notifications off'}</span>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-warning)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
