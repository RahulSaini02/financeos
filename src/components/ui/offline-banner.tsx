"use client";

import { useState, useEffect } from "react";
import { WifiOff, Wifi, CloudOff } from "lucide-react";
import { getPendingCount } from "@/lib/offline";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleOnline = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
      setOnline(true);
      if (count > 0) {
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 5000);
      }
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  if (!online) {
    return (
      <div className="flex items-center gap-2 bg-[var(--color-warning)]/10 border-b border-[var(--color-warning)]/30 px-4 py-2 text-xs text-[var(--color-warning)]">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>You&apos;re offline. Changes will sync when you reconnect.</span>
      </div>
    );
  }

  // Just reconnected with pending
  if (justReconnected && pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 bg-[var(--color-success)]/10 border-b border-[var(--color-success)]/30 px-4 py-2 text-xs text-[var(--color-success)]">
        <Wifi className="h-3.5 w-3.5 shrink-0" />
        <span>Back online. Syncing {pendingCount} pending change{pendingCount > 1 ? "s" : ""}…</span>
      </div>
    );
  }

  return null;
}
