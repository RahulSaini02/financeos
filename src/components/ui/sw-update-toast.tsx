"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "./button";

export function SWUpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    const check = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        setShow(true);
        return;
      }
      reg?.addEventListener("updatefound", () => {
        reg.installing?.addEventListener("statechange", () => {
          if (reg.waiting) setShow(true);
        });
      });
    };
    check();
  }, []);

  const handleReload = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-lg flex items-start gap-3">
      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
      <div className="flex-1 text-sm text-[var(--color-text-primary)]">
        App updated — reload to get the latest.
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleReload}>Reload</Button>
        <button
          onClick={() => setShow(false)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
