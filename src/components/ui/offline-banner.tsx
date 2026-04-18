"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { getPendingCount } from "@/lib/offline";

function subscribeToOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function OfflineBanner() {
  // useSyncExternalStore handles SSR/hydration safely:
  // getServerSnapshot returns true so the server never renders the banner.
  const online = useSyncExternalStore(
    subscribeToOnline,
    () => navigator.onLine,
    () => true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
      if (count > 0) {
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 5000);
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
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
