import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { InvestmentsClient } from "./InvestmentsClient";
import type { Investment, SavingsGoal } from "@/lib/types";

export default async function InvestmentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: investments }, { data: accounts }, { data: savingsGoals }] = await Promise.all([
    supabase
      .from("investments")
      .select("*, account:accounts(id, name, current_balance)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("id, name, current_balance")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("savings_goals")
      .select("*, account:accounts!savings_goals_linked_account_id_fkey(id, name, current_balance)")
      .eq("user_id", user.id)
      .order("created_at"),
  ]);

  return (
    <InvestmentsClient
      initialInvestments={(investments ?? []) as Investment[]}
      accounts={(accounts ?? []) as { id: string; name: string; current_balance: number }[]}
      initialSavingsGoals={(savingsGoals ?? []) as SavingsGoal[]}
    />
  );
}
