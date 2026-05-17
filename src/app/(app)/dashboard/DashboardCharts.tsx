"use client";

import dynamic from "next/dynamic";

// Lazy-load chart components to defer recharts from the critical bundle
const CategoryPieChart = dynamic(
  () => import("@/components/charts/category-pie-chart").then((m) => m.CategoryPieChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

const MonthComparisonChart = dynamic(
  () => import("@/components/charts/month-comparison-chart").then((m) => m.MonthComparisonChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

const NetWorthChart = dynamic(
  () => import("@/components/charts/net-worth-chart").then((m) => m.NetWorthChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] h-64 animate-pulse" />
  );
}

interface DashboardChartsProps {
  categoryBreakdown: Array<{ name: string; amount: number; color: string }>;
  monthlyData: Array<{ month: string; label: string; income: number; expenses: number }>;
  networthTrend: Array<{ month: string; net_worth: number }>;
}

export function DashboardCharts({ categoryBreakdown, monthlyData, networthTrend }: DashboardChartsProps) {
  return (
    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <CategoryPieChart
        data={categoryBreakdown.map((d) => ({
          name: d.name,
          value: d.amount,
          color: d.color,
        }))}
      />
      <MonthComparisonChart monthlyData={monthlyData} />
      {networthTrend.length > 0 ? (
        <NetWorthChart points={networthTrend} />
      ) : (
        <div />
      )}
    </div>
  );
}
