import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  getDefaultPeriodKey,
  periodInfo,
  priorPeriodInfo,
} from "@/lib/review-periods";
import AiReviewClient, { type ReviewData } from "./AiReviewClient";
import { AiAccessGate } from "@/components/ui/ai-access-gate";
import type { UserProfile } from "@/lib/types";

export default async function AiReviewPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch user profile for AI access gate
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, role, email_verified, ai_enabled, ai_access_requested_at, ai_access_requested_reason, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  const userProfile: UserProfile | null = profileRow
    ? (profileRow as UserProfile)
    : null;

  // If AI is not enabled, render gate early (skip heavy DB queries)
  if (!userProfile?.ai_enabled) {
    return <AiAccessGate userProfile={userProfile}>{null}</AiAccessGate>;
  }

  try {
    const now = new Date();

    // Fetch available months (months with confirmed transactions) in parallel
    // with the default-period data
    const availableMonthsPromise = supabase
      .rpc("get_available_review_months", { p_user_id: user.id })
      .then((res) => (res.data ?? []).map((r: { month_key: string }) => r.month_key) as string[]);

    // Default to most recent month that has data; fall back to last completed month
    const availableKeys = await availableMonthsPromise;
    const defaultKey = availableKeys[0] ?? getDefaultPeriodKey(now);

    const { periodStart, periodEnd, label } = periodInfo(defaultKey);
    const { periodStart: priorPeriodStart, periodEnd: priorPeriodEnd } =
      priorPeriodInfo(defaultKey);

    const [cachedInsightRes, lastMonthRes, priorMonthRes] = await Promise.all([
      supabase
        .from("ai_insights")
        .select("content")
        .eq("user_id", user.id)
        .eq("type", "monthly_review")
        .eq("month", defaultKey)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("description, amount_usd, cr_dr, date, category:categories(id, name)")
        .eq("user_id", user.id)
        .eq("import_status", "confirmed")
        .eq("is_internal_transfer", false)
        .gte("date", periodStart.toISOString().split("T")[0])
        .lte("date", periodEnd.toISOString().split("T")[0]),
      supabase
        .from("transactions")
        .select("amount_usd, cr_dr, category:categories(name)")
        .eq("user_id", user.id)
        .eq("import_status", "confirmed")
        .eq("is_internal_transfer", false)
        .gte("date", priorPeriodStart.toISOString().split("T")[0])
        .lte("date", priorPeriodEnd.toISOString().split("T")[0]),
    ]);

    const cachedInsight = cachedInsightRes.data;
    const transactions = lastMonthRes.data ?? [];
    const priorTransactions = priorMonthRes.data ?? [];

    const income = transactions
      .filter((t) => t.cr_dr === "credit")
      .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0);
    const expenses = transactions
      .filter((t) => t.cr_dr === "debit")
      .reduce((s, t) => s + Math.abs(t.amount_usd ?? 0), 0);

    const byCategory: Record<string, { amount: number; count: number }> = {};
    for (const t of transactions) {
      if (t.cr_dr === "debit") {
        const catRaw = t.category as unknown;
        const catName =
          catRaw != null &&
          !Array.isArray(catRaw) &&
          typeof (catRaw as { name?: string }).name === "string"
            ? (catRaw as { name: string }).name
            : "Uncategorized";
        if (!byCategory[catName]) byCategory[catName] = { amount: 0, count: 0 };
        byCategory[catName].amount += Math.abs(t.amount_usd ?? 0);
        byCategory[catName].count++;
      }
    }

    const priorByCategory: Record<string, number> = {};
    for (const t of priorTransactions) {
      if (t.cr_dr === "debit") {
        const catRaw = t.category as unknown;
        const catName =
          catRaw != null &&
          !Array.isArray(catRaw) &&
          typeof (catRaw as { name?: string }).name === "string"
            ? (catRaw as { name: string }).name
            : "Uncategorized";
        priorByCategory[catName] =
          (priorByCategory[catName] ?? 0) + Math.abs(t.amount_usd ?? 0);
      }
    }

    const hasPriorMonth = Object.keys(priorByCategory).length > 0;
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 8)
      .map(([name, { amount, count }]) => {
        const prevAmount = priorByCategory[name] ?? null;
        const changePct =
          prevAmount != null ? ((amount - prevAmount) / prevAmount) * 100 : null;
        const pctOfTotal = expenses > 0 ? (amount / expenses) * 100 : 0;
        return { name, amount, count, pctOfTotal, prevAmount, changePct };
      });

    const initialData: ReviewData = {
      label,
      month: defaultKey,
      cached: !!cachedInsight,
      hasPriorMonth,
      summary: {
        income,
        expenses,
        netCashFlow: income - expenses,
        transactionCount: transactions.length,
      },
      topCategories,
      analysis: cachedInsight?.content ?? "",
    };

    return <AiReviewClient initialData={initialData} availablePeriodKeys={availableKeys} />;
  } catch {
    return <AiReviewClient initialData={null} availablePeriodKeys={[]} />;
  }
}
