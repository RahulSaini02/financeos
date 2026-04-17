import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { TablePageSkeleton } from "@/components/ui/skeleton";
import { TransactionsClient } from "./transactions-client";
import type { Account, Category, Loan } from "@/lib/types";

export default async function TransactionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];

  const [accountsRes, categoriesRes, loansRes, oldestTxnRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).eq("is_active", true).order("name"),
    supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
    supabase.from("loans").select("id, name, current_balance").eq("user_id", user.id).order("name"),
    supabase.from("transactions").select("date").eq("user_id", user.id).order("date", { ascending: true }).limit(1),
  ]);

  const oldestDate = oldestTxnRes.data?.[0]?.date ?? null;
  const useWindow = oldestDate !== null && oldestDate < sixMonthsAgoStr;

  return (
    <Suspense fallback={<TablePageSkeleton rows={10} />}>
      <TransactionsClient
        initialAccounts={(accountsRes.data as Account[]) ?? []}
        initialCategories={(categoriesRes.data as Category[]) ?? []}
        initialLoans={(loansRes.data as Loan[]) ?? []}
        initialWindowStart={useWindow ? sixMonthsAgoStr : null}
      />
    </Suspense>
  );
}
