import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { InvestmentsClient } from "./InvestmentsClient";
import type { Investment } from "@/lib/types";

export default async function InvestmentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: investments }, { data: accounts }] = await Promise.all([
    supabase
      .from("investments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <InvestmentsClient
      initialInvestments={(investments ?? []) as Investment[]}
      accounts={(accounts ?? []) as { id: string; name: string }[]}
    />
  );
}
