import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import AiReviewClient, { type ReviewData } from "./AiReviewClient";

export default async function AiReviewPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dayOfMonth = now.getDate();
    const isFirstHalf = dayOfMonth <= 15;

    // Current period bounds
    const periodStart = isFirstHalf
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), 16);
    const periodEnd = isFirstHalf
      ? new Date(now.getFullYear(), now.getMonth(), 15)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Cache key
    const periodKey = isFirstHalf
      ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-16`;

    // Label for display
    const endDay = periodEnd.getDate();
    const label = isFirstHalf
      ? `${periodStart.toLocaleDateString("en-US", { month: "long" })} 1–15, ${now.getFullYear()}`
      : `${periodStart.toLocaleDateString("en-US", { month: "long" })} 16–${endDay}, ${now.getFullYear()}`;

    // Prior period bounds
    const priorPeriodEnd = new Date(periodStart.getTime() - 86400000);
    const priorPeriodStart = isFirstHalf
      ? new Date(now.getFullYear(), now.getMonth() - 1, 16)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: cachedInsight } = await supabase
      .from("ai_insights")
      .select("content")
      .eq("user_id", user.id)
      .eq("type", "monthly_review")
      .eq("month", periodKey)
      .maybeSingle();

    const [lastMonthRes, priorMonthRes] = await Promise.all([
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
          catRaw != null && !Array.isArray(catRaw) && typeof (catRaw as { name?: string }).name === "string"
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
          catRaw != null && !Array.isArray(catRaw) && typeof (catRaw as { name?: string }).name === "string"
            ? (catRaw as { name: string }).name
            : "Uncategorized";
        priorByCategory[catName] = (priorByCategory[catName] ?? 0) + Math.abs(t.amount_usd ?? 0);
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
      month: periodKey,
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

    return <AiReviewClient initialData={initialData} />;
  } catch {
    return <AiReviewClient initialData={null} />;
  }
}
