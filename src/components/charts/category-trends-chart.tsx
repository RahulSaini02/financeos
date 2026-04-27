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
import { compactCurrency, ChartTooltip } from "@/components/charts/chart-utils";

interface CategoryTrendsChartProps {
  data: Array<{
    label: string;
    [categoryName: string]: number | string;
  }>;
  categories: string[];
}

const CATEGORY_COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#22c55e", "#06b6d4"];

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
            <Tooltip content={<ChartTooltip />} />
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
