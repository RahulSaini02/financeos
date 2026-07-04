import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { SubscriptionsClient } from "./SubscriptionsClient";
import type { Subscription, Account, Category } from "@/lib/types";

export default async function SubscriptionsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subscriptions }, { data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*, account:accounts(id, name)")
      .eq("user_id", user.id)
      .order("next_billing_date", { ascending: true }),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <SubscriptionsClient
      initialSubscriptions={(subscriptions ?? []) as Subscription[]}
      accounts={(accounts ?? []) as Account[]}
      categories={(categories ?? []) as Category[]}
    />
  );
}
