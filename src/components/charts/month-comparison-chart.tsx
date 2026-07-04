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
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";
import { BarChart3, X } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";

interface MonthlyDataPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
}

interface MonthComparisonChartProps {
  monthlyData: MonthlyDataPoint[];
  isNewUser?: boolean;
  selectedCategory?: string | null;
  selectedCategoryColor?: string;
  categoryMonthlyData?: Record<string, Array<{ month: string; label: string; expenses: number }>>;
  onClearCategory?: () => void;
}

type Period = "3m" | "6m" | "12m";

const PERIODS: { value: Period; label: string; count: number }[] = [
  { value: "3m", label: "3M", count: 3 },
  { value: "6m", label: "6M", count: 6 },
  { value: "12m", label: "12M", count: 12 },
];

export function MonthComparisonChart({
  monthlyData,
  isNewUser,
  selectedCategory,
  selectedCategoryColor = "#6366f1",
  categoryMonthlyData = {},
  onClearCategory,
}: MonthComparisonChartProps) {
  const { fmt } = useCurrency();
  const [period, setPeriod] = useState<Period>("3m");

  const isEmpty = isNewUser || monthlyData.every((d) => d.income === 0 && d.expenses === 0);
  if (isEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Month Comparison</CardTitle>
        </CardHeader>
        <ChartEmptyState
          icon={BarChart3}
          title="Income vs Expenses"
          description="Add transactions to see your monthly cash flow comparison."
          ctaLabel="Import transactions"
          ctaHref="/import"
        />
      </Card>
    );
  }

  const selected = PERIODS.find((p) => p.value === period)!;

  // Category spending trend mode
  if (selectedCategory && categoryMonthlyData[selectedCategory]) {
    const catData = categoryMonthlyData[selectedCategory]
      .slice(-selected.count)
      .map((d) => ({ name: d.label, Spending: Math.round(d.expenses) }));

    const nonZero = catData.map((d) => d.Spending).filter((v) => v > 0);
    const avgSpend =
      nonZero.length > 0
        ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length)
        : 0;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle>Spending Trend</CardTitle>
            <button
              onClick={onClearCategory}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition-colors shrink-0"
            >
              {selectedCategory}
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  period === p.value
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-primary)] opacity-60 hover:opacity-100"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <div className="mt-2">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={catData}
              margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
              barCategoryGap="30%"
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
                formatter={(v: unknown) => [fmt(v as number), selectedCategory]}
                cursor={{ fill: "#222230" }}
              />
              <Bar
                dataKey="Spending"
                fill={selectedCategoryColor}
                radius={[3, 3, 0, 0]}
                maxBarSize={period === "12m" ? 24 : 40}
              />
              {avgSpend > 0 && (
                <ReferenceLine
                  y={avgSpend}
                  stroke="#f59e0b"
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Avg ${fmt(avgSpend)}`,
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

  // Default: income vs expenses comparison
  const chartData = monthlyData.slice(-selected.count).map((d) => ({
    name: d.label,
    Income: Math.round(d.income),
    Expenses: Math.round(d.expenses),
  }));

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
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                period === p.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] opacity-60 hover:opacity-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={320}>
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
              formatter={(v: unknown, name: unknown) => [fmt(v as number), name as string]}
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
                  value: `Avg spend ${fmt(avgExpenses)}`,
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
