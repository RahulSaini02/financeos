"use client";

import { useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export function PullToRefresh({ children, onRefresh, threshold = 72 }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const pullDistRef = useRef<number>(0);
  const isRefreshingRef = useRef(false);
  const isActiveRef = useRef(false);

  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const getScrollTop = useCallback((): number => {
    return containerRef.current?.scrollTop ?? window.scrollY;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isRefreshingRef.current) return;
      if (getScrollTop() > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullDistRef.current = 0;
      isActiveRef.current = true;
    },
    [getScrollTop]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isActiveRef.current || isRefreshingRef.current) return;
      if (getScrollTop() > 0) {
        isActiveRef.current = false;
        pullDistRef.current = 0;
        setPullDist(0);
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        pullDistRef.current = 0;
        setPullDist(0);
        return;
      }
      // Square-root damping so the pull feels elastic
      const damped = Math.min(Math.sqrt(delta) * 6, threshold * 1.5);
      pullDistRef.current = damped;
      setPullDist(damped);
      // Prevent native overscroll while pulling down
      if (e.cancelable) e.preventDefault();
    },
    [getScrollTop, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;
    const dist = pullDistRef.current;
    pullDistRef.current = 0;
    setPullDist(0);

    if (dist < threshold || isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      isRefreshingRef.current = false;
      setRefreshing(false);
    }
  }, [onRefresh, threshold]);

  const showIndicator = refreshing || pullDist > 10;
  const indicatorOpacity = refreshing ? 1 : Math.min(pullDist / threshold, 1);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Pull indicator pill */}
      {showIndicator && (
        <div
          className="pointer-events-none absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2"
          style={{ top: 8, opacity: indicatorOpacity, transition: "opacity 0.1s" }}
        >
          <Loader2
            className={`h-4 w-4 text-[var(--color-accent)] ${refreshing ? "animate-spin" : ""}`}
          />
          <span className="text-xs text-[var(--color-text-secondary)]">
            {refreshing
              ? "Refreshing…"
              : pullDist >= threshold
              ? "Release to refresh"
              : "Pull to refresh"}
          </span>
        </div>
      )}

      {/* Slide content down during pull */}
      <div
        style={{
          transform:
            refreshing
              ? "translateY(48px)"
              : pullDist > 0
              ? `translateY(${Math.min(pullDist * 0.5, threshold * 0.75)}px)`
              : undefined,
          transition: pullDist === 0 && !refreshing ? "transform 0.25s ease" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
