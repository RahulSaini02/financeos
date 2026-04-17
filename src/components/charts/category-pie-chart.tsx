"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface CategoryPieChartProps {
  data: Array<{ name: string; value: number; color: string }>;
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <span className="text-xs text-[var(--color-text-muted)]">This month</span>
        </CardHeader>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          No expenses recorded yet.
        </p>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
        <span className="text-xs text-[var(--color-text-muted)]">
          This month · {formatCurrency(total)}
        </span>
      </CardHeader>
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={170}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={78}
              dataKey="value"
              nameKey="name"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#18181f",
                border: "1px solid #2a2a3d",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: unknown) => [
                `${formatCurrency(v as number)} (${(
                  ((v as number) / total) *
                  100
                ).toFixed(1)}%)`,
                "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
          {data.map((cat) => (
            <div key={cat.name} className="flex items-center gap-2 min-w-0">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: cat.color }}
              />
              <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1">
                {cat.name}
              </span>
              <span className="text-xs font-medium text-[var(--color-text-primary)] shrink-0">
                {formatCurrency(cat.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
