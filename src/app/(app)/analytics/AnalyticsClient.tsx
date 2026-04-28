"use client";

import { formatCurrency } from "@/lib/utils";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { SavingsRateChart } from "@/components/charts/savings-rate-chart";
import { CategoryTrendsChart } from "@/components/charts/category-trends-chart";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { Card } from "@/components/ui/card";

interface MonthlyDataPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  savingsRate: number;
  netCashFlow: number;
}

interface AnalyticsData {
  monthlyData: MonthlyDataPoint[];
  categoryTrends: Array<{ month: string; label: string; [key: string]: number | string }>;
  topCategories: string[];
  projection: MonthlyDataPoint[];
  networthPoints: Array<{ month: string; net_worth: number }>;
  summary: {
    avgMonthlyIncome: number;
    avgMonthlyExpenses: number;
    avgSavingsRate: number;
    projectedNetCashFlow3Mo: number;
    currentNetWorth: number;
  };
}

interface AnalyticsClientProps {
  data: AnalyticsData;
}

interface KpiCardProps {
  label: string;
  value: string;
  valueColor?: string;
  badge?: React.ReactNode;
}

function KpiCard({ label, value, valueColor, badge }: KpiCardProps) {
  return (
    <Card>
      <p className="text-xs text-[var(--color-text-muted)] mb-1.5">{label}</p>
      <div className="flex items-end gap-2">
        <p
          className="text-lg sm:text-xl font-semibold tracking-tight leading-none"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </p>
        {badge}
      </div>
    </Card>
  );
}

export function AnalyticsClient({ data }: AnalyticsClientProps) {
  const { monthlyData, categoryTrends, topCategories, projection, networthPoints, summary } = data;

  // Combine historical + projected for cash flow chart
  const cashFlowData = [
    ...monthlyData.map((d) => ({ ...d, isProjected: false })),
    ...projection.map((d) => ({ ...d, isProjected: true })),
  ];

  const projNet = summary.projectedNetCashFlow3Mo;
  const projPositive = projNet >= 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Row 1 — KPI summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Avg Monthly Income"
          value={formatCurrency(summary.avgMonthlyIncome)}
          valueColor="var(--color-success)"
        />
        <KpiCard
          label="Avg Monthly Expenses"
          value={formatCurrency(summary.avgMonthlyExpenses)}
          valueColor="var(--color-danger)"
        />
        <KpiCard
          label="Avg Savings Rate"
          value={`${summary.avgSavingsRate.toFixed(1)}%`}
          valueColor={summary.avgSavingsRate >= 0 ? "var(--color-success)" : "var(--color-danger)"}
        />
        <KpiCard
          label="3-Mo Projected Net"
          value={formatCurrency(Math.abs(projNet))}
          valueColor={projPositive ? "var(--color-success)" : "var(--color-danger)"}
          badge={
            <span
              className="text-xs font-medium pb-0.5"
              style={{ color: projPositive ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {projPositive ? "▲" : "▼"}
            </span>
          }
        />
      </div>

      {/* Row 2 — Cash Flow Chart (full width) */}
      <CashFlowChart data={cashFlowData} />

      {/* Row 3 — Savings Rate + Category Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SavingsRateChart data={monthlyData} />
        <CategoryTrendsChart
          data={categoryTrends.slice(-6)}
          categories={topCategories}
        />
      </div>

      {/* Row 4 — Net Worth Trend (full width) */}
      {networthPoints.length > 0 && <NetWorthChart points={networthPoints} />}
    </div>
  );
}
