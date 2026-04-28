import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SavingsGoalsClient } from "./SavingsGoalsClient";
import type { SavingsGoal } from "@/lib/types";

export default async function SavingsGoalsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: goals }, { data: accounts }] = await Promise.all([
    supabase
      .from("savings_goals")
      .select("*, account:accounts(id, name, current_balance)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("id, name, current_balance")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <SavingsGoalsClient
      initialGoals={(goals ?? []) as SavingsGoal[]}
      accounts={(accounts ?? []) as { id: string; name: string; current_balance: number }[]}
    />
  );
}
