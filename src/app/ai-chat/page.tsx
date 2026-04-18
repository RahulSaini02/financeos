import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import AiChatClient from "./AiChatClient";
import type { AiInsight } from "@/lib/types";

export default async function AiChatPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("user_id", user.id)
    .in("type", ["daily", "monthly", "alert", "monthly_review"])
    .order("created_at", { ascending: false })
    .limit(20);

  return <AiChatClient initialInsights={(data as AiInsight[]) ?? []} />;
}
