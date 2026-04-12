"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
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

interface MonthlyDataPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
}

interface MonthComparisonChartProps {
  monthlyData: MonthlyDataPoint[];
}

type Period = "3m" | "6m" | "12m";

const PERIODS: { value: Period; label: string; count: number }[] = [
  { value: "3m", label: "3M", count: 3 },
  { value: "6m", label: "6M", count: 6 },
  { value: "12m", label: "12M", count: 12 },
];

export function MonthComparisonChart({ monthlyData }: MonthComparisonChartProps) {
  const [period, setPeriod] = useState<Period>("3m");

  const selected = PERIODS.find((p) => p.value === period)!;
  // Always take the last N months from the 12-month array
  const chartData = monthlyData.slice(-selected.count).map((d) => ({
    name: d.label,
    Income: Math.round(d.income),
    Expenses: Math.round(d.expenses),
  }));

  // Reference line = avg expenses over the selected window (skip months with 0)
  const nonZeroExpenses = chartData.map((d) => d.Expenses).filter((v) => v > 0);
  const avgExpenses =
    nonZeroExpenses.length > 0
      ? Math.round(nonZeroExpenses.reduce((s, v) => s + v, 0) / nonZeroExpenses.length)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Month Comparison</CardTitle>
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
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
            barCategoryGap="30%"
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#606070", fontSize: period === "12m" ? 9 : 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#606070", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#18181f",
                border: "1px solid #2a2a3d",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#f0f0f5", fontWeight: 600 }}
              formatter={(v: unknown, name: unknown) => [formatCurrency(v as number), name as string]}
              cursor={{ fill: "#222230" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9090a0", paddingTop: 8 }} />
            <Bar dataKey="Income" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={period === "12m" ? 24 : 40} />
            <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={period === "12m" ? 24 : 40} />
            {avgExpenses > 0 && (
              <ReferenceLine
                y={avgExpenses}
                stroke="#f59e0b"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{
                  value: `Avg spend ${formatCurrency(avgExpenses)}`,
                  fill: "#f59e0b",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
