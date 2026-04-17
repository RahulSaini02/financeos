import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import BudgetsClient from "./budgets-page-client";
import type { Category } from "@/lib/types";

export default async function BudgetsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthParam = `${year}-${pad(month)}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStart = `${nextYear}-${pad(nextMonth)}-01`;

  const [catRes, budgetRes, txnRes] = await Promise.all([
    supabase.from("categories").select("*").eq("user_id", user.id).in("type", ["expense"]).order("name"),
    supabase.from("budgets").select("*").eq("user_id", user.id).eq("month", monthParam),
    supabase.from("transactions").select("category_id, amount_usd").eq("user_id", user.id).eq("cr_dr", "debit").eq("is_internal_transfer", false).gte("date", monthParam).lt("date", nextMonthStart),
  ]);

  return (
    <Suspense fallback={<GridPageSkeleton cards={6} />}>
      <BudgetsClient
        initialCategories={(catRes.data as Category[]) ?? []}
        initialBudgets={budgetRes.data ?? []}
        initialTransactions={txnRes.data ?? []}
        initialYear={year}
        initialMonth={month}
        userId={user.id}
      />
    </Suspense>
  );
}
