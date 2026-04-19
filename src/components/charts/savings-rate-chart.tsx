"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface SavingsRateDataPoint {
  label: string;
  savingsRate: number;
}

interface SavingsRateChartProps {
  data: SavingsRateDataPoint[];
}

type Period = "6M" | "12M";

const PERIODS: { value: Period; label: string; count: number }[] = [
  { value: "6M", label: "6M", count: 6 },
  { value: "12M", label: "12M", count: 12 },
];

interface TooltipPayloadItem {
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rate = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl text-xs">
      <p className="text-[var(--color-text-muted)] mb-0.5">{label}</p>
      <p className="font-semibold text-[var(--color-text-primary)]">
        {rate.toFixed(1)}% savings rate
      </p>
    </div>
  );
}

export function SavingsRateChart({ data }: SavingsRateChartProps) {
  const [period, setPeriod] = useState<Period>("6M");

  const selected = PERIODS.find((p) => p.value === period)!;
  const chartData = data.slice(-selected.count).map((d) => ({
    name: d.label,
    "Savings Rate": parseFloat(d.savingsRate.toFixed(2)),
  }));

  const nonZero = chartData.map((d) => d["Savings Rate"]).filter((v) => v !== 0);
  const avg =
    nonZero.length > 0
      ? parseFloat((nonZero.reduce((s, v) => s + v, 0) / nonZero.length).toFixed(1))
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings Rate Trend</CardTitle>
        <div className="flex items-center gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                period === p.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="savingsRateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#606070", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#606070", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#2a2a3d" }} />
            <ReferenceLine y={0} stroke="#2a2a3d" strokeWidth={1} />
            {avg !== 0 && (
              <ReferenceLine
                y={avg}
                stroke="#f59e0b"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{
                  value: `Avg ${avg}%`,
                  fill: "#f59e0b",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="Savings Rate"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#savingsRateGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-accent)", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
