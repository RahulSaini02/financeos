import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { RecurringClient } from "./RecurringClient";
import type { RecurringRule } from "@/lib/types";

export default async function RecurringRulesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: rules },
    { data: accounts },
    { data: categories },
    { data: autoRenewSubs },
  ] = await Promise.all([
    supabase
      .from("recurring_rules")
      .select("*")
      .eq("user_id", user.id)
      .order("next_due"),
    supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("subscriptions")
      .select("id, name, billing_cost, billing_cycle_months, next_billing_date, account_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("auto_renew", true)
      .order("next_billing_date"),
  ]);

  return (
    <RecurringClient
      initialRules={(rules ?? []) as RecurringRule[]}
      accounts={(accounts ?? []) as { id: string; name: string }[]}
      categories={(categories ?? []) as { id: string; name: string }[]}
      initialAutoRenewSubs={(autoRenewSubs ?? []) as {
        id: string;
        name: string;
        billing_cost: number;
        billing_cycle_months: number;
        next_billing_date: string | null;
        account_id: string | null;
      }[]}
    />
  );
}
