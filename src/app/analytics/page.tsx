import { redirect } from "next/navigation";
import { BarChart2 } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/page-header";
import { AnalyticsClient } from "./AnalyticsClient";

type MonthBucket = {
  income: number;
  expenses: number;
  byCategory: Record<string, number>;
};

type AnalyticsData = {
  monthlyData: Array<{ month: string; label: string; income: number; expenses: number; netCashFlow: number; savingsRate: number }>;
  categoryTrends: Array<{ month: string; label: string; [k: string]: number | string }>;
  topCategories: string[];
  projection: Array<{ month: string; label: string; income: number; expenses: number; netCashFlow: number; savingsRate: number }>;
  networthPoints: Array<{ month: string; net_worth: number }>;
  summary: { avgMonthlyIncome: number; avgMonthlyExpenses: number; avgSavingsRate: number; projectedNetCashFlow3Mo: number; currentNetWorth: number };
} | null;

async function loadAnalyticsData(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
): Promise<{ data: AnalyticsData; hasEnoughData: boolean }> {

  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const twelveMonthsAgoStr = `${twelveMonthsAgo.getFullYear()}-${pad(twelveMonthsAgo.getMonth() + 1)}-01`;
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [txnRes, networthRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount_usd, cr_dr, date, category:categories(name)")
      .eq("user_id", userId)
      .eq("import_status", "confirmed")
      .eq("is_internal_transfer", false)
      .gte("date", twelveMonthsAgoStr)
      .lte("date", endOfThisMonth),
    supabase
      .from("networth_snapshots")
      .select("month, net_worth")
      .eq("user_id", userId)
      .order("month", { ascending: true })
      .limit(24),
  ]);

  const transactions = txnRes.data ?? [];
  const networthPoints = (networthRes.data ?? []).map((r) => ({
    month: r.month as string,
    net_worth: r.net_worth as number,
  }));

  const monthBuckets: Record<string, MonthBucket> = {};

  for (const t of transactions) {
    const key = (t.date as string).substring(0, 7);
    if (!monthBuckets[key]) {
      monthBuckets[key] = { income: 0, expenses: 0, byCategory: {} };
    }
    const amt = Math.abs((t.amount_usd as number) ?? 0);
    if (t.cr_dr === "credit") {
      monthBuckets[key].income += amt;
    } else {
      monthBuckets[key].expenses += amt;
      const catRaw = t.category as unknown;
      const catName =
        catRaw != null &&
        !Array.isArray(catRaw) &&
        typeof (catRaw as { name?: string }).name === "string"
          ? (catRaw as { name: string }).name
          : "Uncategorized";
      monthBuckets[key].byCategory[catName] =
        (monthBuckets[key].byCategory[catName] ?? 0) + amt;
    }
  }

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const monthStr = `${key}-01`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "America/Los_Angeles" });
    const bucket = monthBuckets[key];
    const income = Math.round((bucket?.income ?? 0) * 100) / 100;
    const expenses = Math.round((bucket?.expenses ?? 0) * 100) / 100;
    const netCashFlow = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    return { month: monthStr, label, income, expenses, netCashFlow, savingsRate };
  });

  const totalByCategory: Record<string, number> = {};
  for (const bucket of Object.values(monthBuckets)) {
    for (const [cat, amt] of Object.entries(bucket.byCategory)) {
      totalByCategory[cat] = (totalByCategory[cat] ?? 0) + amt;
    }
  }
  const topCategories = Object.entries(totalByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const categoryTrends = monthlyData.map((m) => {
    const key = m.month.substring(0, 7);
    const bucket = monthBuckets[key];
    const row: { month: string; label: string; [k: string]: number | string } = { month: m.month, label: m.label };
    for (const cat of topCategories) {
      row[cat] = Math.round((bucket?.byCategory[cat] ?? 0) * 100) / 100;
    }
    return row;
  });

  const recentWithData = [...monthlyData].reverse().filter((m) => m.income > 0 || m.expenses > 0).slice(0, 3);
  const avgIncome = recentWithData.length > 0 ? recentWithData.reduce((s, m) => s + m.income, 0) / recentWithData.length : 0;
  const avgExpenses = recentWithData.length > 0 ? recentWithData.reduce((s, m) => s + m.expenses, 0) / recentWithData.length : 0;
  const projAvgSavingsRate = avgIncome > 0 ? ((avgIncome - avgExpenses) / avgIncome) * 100 : 0;
  const projNetCashFlow = avgIncome - avgExpenses;

  const projection = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(startOfThisMonth.getFullYear(), startOfThisMonth.getMonth() + 1 + i, 1);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "America/Los_Angeles" });
    return {
      month: `${key}-01`,
      label,
      income: Math.round(avgIncome * 100) / 100,
      expenses: Math.round(avgExpenses * 100) / 100,
      netCashFlow: Math.round(projNetCashFlow * 100) / 100,
      savingsRate: parseFloat(projAvgSavingsRate.toFixed(2)),
    };
  });

  const activeMonths = monthlyData.filter((m) => m.income > 0 || m.expenses > 0);
  const avgMonthlyIncome = activeMonths.length > 0 ? activeMonths.reduce((s, m) => s + m.income, 0) / activeMonths.length : 0;
  const avgMonthlyExpenses = activeMonths.length > 0 ? activeMonths.reduce((s, m) => s + m.expenses, 0) / activeMonths.length : 0;
  const avgSavingsRate = avgMonthlyIncome > 0 ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100 : 0;
  const currentNetWorth = networthPoints.length > 0 ? networthPoints[networthPoints.length - 1].net_worth : 0;

  return {
    hasEnoughData: activeMonths.length >= 2,
    data: {
      monthlyData,
      categoryTrends,
      topCategories,
      projection,
      networthPoints,
      summary: {
        avgMonthlyIncome,
        avgMonthlyExpenses,
        avgSavingsRate,
        projectedNetCashFlow3Mo: projNetCashFlow * 3,
        currentNetWorth,
      },
    },
  };
}

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let hasEnoughData = false;
  let analyticsData: AnalyticsData = null;

  try {
    const result = await loadAnalyticsData(supabase, user.id);
    hasEnoughData = result.hasEnoughData;
    analyticsData = result.data;
  } catch {
    // fall through to empty state
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <BarChart2 className="h-12 w-12 text-[var(--color-text-muted)] mb-4" />
      <p className="text-[var(--color-text-primary)] font-medium text-base">Not enough data yet</p>
      <p className="text-[var(--color-text-muted)] text-sm mt-1 max-w-xs">
        Add a few months of transactions to see cash flow analytics and spending trends.
      </p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      <PageHeader title="Analytics" subtitle="Cash flow trends, spending patterns & forecasts" />
      {!hasEnoughData || !analyticsData ? emptyState : <AnalyticsClient data={analyticsData} />}
    </div>
  );
}
