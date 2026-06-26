"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";
import { PieChart as PieChartIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CategoryPieChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  selectedCategory?: string | null;
  onCategorySelect?: (name: string | null) => void;
}

export function CategoryPieChart({ data, selectedCategory, onCategorySelect }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <span className="text-xs text-[var(--color-text-muted)]">This month</span>
        </CardHeader>
        <ChartEmptyState
          icon={PieChartIcon}
          title="No spending data yet"
          description="Add transactions this month to see your category breakdown."
          ctaLabel="Import transactions"
          ctaHref="/import"
        />
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const hasSelection = selectedCategory !== null && selectedCategory !== undefined;

  const handlePieClick = (entry: { name?: string }) => {
    const name = entry.name;
    if (!name || name === "Other") return;
    onCategorySelect?.(name === selectedCategory ? null : name);
  };

  const handleLegendClick = (name: string) => {
    if (name === "Other") return;
    onCategorySelect?.(name === selectedCategory ? null : name);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
        <span className="text-xs text-[var(--color-text-muted)]">
          {hasSelection ? (
            <span className="text-[var(--color-accent)]">
              {selectedCategory} · click to deselect
            </span>
          ) : (
            `This month · ${formatCurrency(total)}`
          )}
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
              onClick={handlePieClick}
              style={{ cursor: "pointer" }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  opacity={!hasSelection || selectedCategory === entry.name ? 1 : 0.25}
                  stroke={selectedCategory === entry.name ? "#ffffff" : "none"}
                  strokeWidth={selectedCategory === entry.name ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#18181f",
                border: "1px solid #2a2a3d",
                borderRadius: 8,
                fontSize: 12,
              }}
              separator=""
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
          {data.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            const isDimmed = hasSelection && !isSelected;
            const isClickable = cat.name !== "Other";
            return (
              <button
                key={cat.name}
                onClick={() => handleLegendClick(cat.name)}
                disabled={!isClickable}
                className={`flex items-center gap-2 min-w-0 text-left rounded px-1 py-0.5 transition-all ${
                  isSelected
                    ? "ring-1 ring-[var(--color-accent)] bg-[var(--color-accent)]/5"
                    : isClickable
                    ? "hover:bg-[var(--color-bg-tertiary)]"
                    : ""
                } ${isDimmed ? "opacity-30" : ""}`}
              >
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
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
