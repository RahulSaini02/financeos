"use client";

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface CashFlowDataPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  isProjected?: boolean;
}

interface CashFlowChartProps {
  data: CashFlowDataPoint[];
}

type Period = "6M" | "12M" | "All";

const PERIODS: { value: Period; label: string; count: number | null }[] = [
  { value: "6M", label: "6M", count: 6 },
  { value: "12M", label: "12M", count: 12 },
  { value: "All", label: "All", count: null },
];

const compactCurrency = (v: number) => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
};

interface TooltipPayloadItem {
  name: string;
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
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-[var(--color-text-primary)] mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-0.5">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const [period, setPeriod] = useState<Period>("6M");

  const selected = PERIODS.find((p) => p.value === period)!;
  const chartData = (selected.count ? data.slice(-selected.count) : data).map((d) => ({
    name: d.label,
    Income: Math.round(d.income),
    Expenses: Math.round(d.expenses),
    "Net Cash Flow": Math.round(d.netCashFlow),
    isProjected: d.isProjected ?? false,
  }));

  const hasProjected = chartData.some((d) => d.isProjected);
  const projectedStart = chartData.findIndex((d) => d.isProjected);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Cash Flow</CardTitle>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Income vs Expenses</p>
        </div>
        <div className="flex items-center gap-1.5">
          {hasProjected && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] mr-1">
              Projected
            </span>
          )}
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
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
            barCategoryGap="30%"
            barGap={4}
          >
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
              tickFormatter={compactCurrency}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#222230" }} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9090a0", paddingTop: 8 }} />
            <ReferenceLine y={0} stroke="#2a2a3d" strokeWidth={1} />
            {projectedStart > 0 && (
              <ReferenceLine
                x={chartData[projectedStart]?.name}
                stroke="#6366f1"
                strokeDasharray="4 3"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            )}
            <Bar
              dataKey="Income"
              fill="#22c55e"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
              fillOpacity={1}
            />
            <Bar
              dataKey="Expenses"
              fill="#ef4444"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
              fillOpacity={1}
            />
            <Line
              type="monotone"
              dataKey="Net Cash Flow"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-accent)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
