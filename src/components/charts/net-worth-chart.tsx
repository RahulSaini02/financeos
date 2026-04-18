"use client";

import { useState, useId, useRef, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface NetworthPoint {
  month: string;
  net_worth: number;
}

interface NetWorthChartProps {
  points: NetworthPoint[];
}

export function NetWorthChart({ points }: NetWorthChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const uid = useId().replace(/:/g, "");
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const W = 800;
  const H = 340;
  const PAD_L = 80;
  const PAD_R = 12;
  const PAD_T = 28;
  const PAD_B = 40;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const values = points.map((p) => p.net_worth);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin || Math.abs(rawMax) || 1;

  const padFrac = 0.18;
  const yMin = rawMin - rawRange * padFrac;
  const yMax = rawMax + rawRange * padFrac;
  const yRange = yMax - yMin;

  const toX = (i: number) =>
    PAD_L + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const toY = (val: number) =>
    PAD_T + chartH - ((val - yMin) / yRange) * chartH;

  const coords = points.map((p, i) => ({ x: toX(i), y: toY(p.net_worth) }));

  let linePath = "";
  let areaPath = "";
  if (coords.length === 1) {
    linePath = `M ${coords[0].x},${coords[0].y}`;
  } else {
    linePath = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const px = coords[i - 1].x;
      const py = coords[i - 1].y;
      const cx = coords[i].x;
      const cy = coords[i].y;
      const cpx = (px + cx) / 2;
      linePath += ` C ${cpx},${py} ${cpx},${cy} ${cx},${cy}`;
    }
    const baseline = PAD_T + chartH;
    areaPath =
      linePath +
      ` L ${coords[coords.length - 1].x},${baseline} L ${coords[0].x},${baseline} Z`;
  }

  useEffect(() => {
    const line = lineRef.current;
    if (!line || coords.length < 2) return;
    const len = line.getTotalLength();
    line.style.strokeDasharray = String(len);
    line.style.strokeDashoffset = String(len);
    line.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        line.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)";
        line.style.strokeDashoffset = "0";
      });
    });

    const area = areaRef.current;
    if (area) {
      area.style.opacity = "0";
      area.style.transition = "none";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          area.style.transition = "opacity 1.2s ease-out 0.6s";
          area.style.opacity = "1";
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePath]);

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaPercent = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
  const isUp = delta >= 0;

  const gridLines = [0.2, 0.5, 0.8].map((frac) => ({
    y: PAD_T + chartH * frac,
    val: yMax - frac * yRange,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Trend</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {points.length} month{points.length !== 1 ? "s" : ""}
          </span>
          {points.length > 1 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                isUp
                  ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                  : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
              }`}
            >
              {isUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isUp ? "+" : ""}
              {deltaPercent.toFixed(1)}%
            </span>
          )}
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {formatCurrency(last)}
          </span>
        </div>
      </CardHeader>

      <div
        ref={containerRef}
        className="relative mt-2"
        onMouseLeave={() => { setHovered(null); setMousePos(null); }}
        onMouseMove={handleMouseMove}
      >
        {/* HTML tooltip — rendered in real pixels, not SVG units */}
        {hovered !== null && mousePos && (() => {
          const val = points[hovered].net_worth;
          const prevVal = hovered > 0 ? points[hovered - 1].net_worth : null;
          const mom = prevVal !== null ? val - prevVal : null;
          const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 400;
          const tooltipWidth = 170;
          let left = mousePos.x + 14;
          if (left + tooltipWidth > containerWidth) left = mousePos.x - tooltipWidth - 14;
          return (
            <div
              style={{ position: "absolute", left, top: mousePos.y - 16, pointerEvents: "none", zIndex: 10 }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl"
            >
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                {new Date(points[hovered].month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
              </p>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {formatCurrency(val)}
              </p>
              {mom !== null && (
                <p className={`text-xs mt-0.5 ${mom >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                  {mom >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(mom))} MoM
                </p>
              )}
            </div>
          );
        })()}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          style={{ height: 320 }}
          aria-label="Net worth trend chart"
        >
          <defs>
            <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`clip-${uid}`}>
              <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} />
            </clipPath>
          </defs>

          {gridLines.map(({ y, val }) => (
            <g key={y}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="0.75"
                strokeDasharray="4 4"
              />
              <text
                x={PAD_L - 8}
                y={y + 4}
                fontSize="13"
                fill="var(--color-text-muted)"
                textAnchor="end"
              >
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(val)}
              </text>
            </g>
          ))}

          {yMin < 0 && yMax > 0 &&
            (() => {
              const zeroY = toY(0);
              return (
                <line
                  x1={PAD_L}
                  y1={zeroY}
                  x2={W - PAD_R}
                  y2={zeroY}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              );
            })()}

          {hovered !== null && (
            <line
              x1={coords[hovered].x}
              y1={PAD_T}
              x2={coords[hovered].x}
              y2={PAD_T + chartH}
              stroke="var(--color-accent)"
              strokeWidth="1"
              strokeDasharray="4 3"
              strokeOpacity="0.5"
            />
          )}

          {areaPath && (
            <path
              ref={areaRef}
              d={areaPath}
              fill={`url(#grad-${uid})`}
              clipPath={`url(#clip-${uid})`}
            />
          )}

          <path
            ref={lineRef}
            d={linePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath={`url(#clip-${uid})`}
          />

          {coords.map((c, i) => (
            <g
              key={i}
              style={{
                animation: `fadeInUp 0.3s ease-out ${0.8 + i * 0.06}s both`,
              }}
            >
              <rect
                x={c.x - (i === 0 ? 0 : chartW / points.length / 2)}
                y={PAD_T}
                width={chartW / points.length}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                style={{ cursor: "crosshair" }}
              />
              {hovered === i && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={10}
                  fill="var(--color-accent)"
                  fillOpacity="0.15"
                />
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r={hovered === i ? 5 : 3.5}
                fill={
                  hovered === i
                    ? "var(--color-accent)"
                    : "var(--color-bg-secondary)"
                }
                stroke="var(--color-accent)"
                strokeWidth="2"
                style={{ transition: "r 0.1s, fill 0.1s" }}
              />
              <text
                x={c.x}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill={
                  hovered === i
                    ? "var(--color-text-primary)"
                    : "var(--color-text-muted)"
                }
                fontWeight={hovered === i ? "600" : "400"}
                style={{ transition: "fill 0.1s" }}
              >
                {new Date(points[i].month + "T00:00:00Z").toLocaleDateString(
                  "en-US",
                  { month: "short", year: "2-digit", timeZone: "UTC" }
                )}
              </text>
            </g>
          ))}

        </svg>
      </div>
    </Card>
  );
}
