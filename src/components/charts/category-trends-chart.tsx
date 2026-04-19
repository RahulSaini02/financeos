"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface CategoryTrendsChartProps {
  data: Array<{
    label: string;
    [categoryName: string]: number | string;
  }>;
  categories: string[];
}

const CATEGORY_COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#22c55e", "#06b6d4"];

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
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl text-xs min-w-[160px]">
      <p className="font-semibold text-[var(--color-text-primary)] mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3 mb-0.5">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CategoryTrendsChart({ data, categories }: CategoryTrendsChartProps) {
  const chartData = data.map((d) => ({ ...d, name: d.label }));
  const displayCategories = categories.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Spending by Category</CardTitle>
      </CardHeader>
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
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
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9090a0", paddingTop: 8 }} />
            {displayCategories.map((cat, i) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
