import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import AiChatClient from "./AiChatClient";
import { AiAccessGate } from "@/components/ui/ai-access-gate";
import type { AiInsight, UserProfile } from "@/lib/types";

export default async function AiChatPage() {
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

  // Only fetch insights if AI is enabled (avoids unnecessary DB query)
  let initialInsights: AiInsight[] = [];
  if (userProfile?.ai_enabled) {
    const { data } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("user_id", user.id)
      .in("type", ["daily", "monthly", "alert", "monthly_review"])
      .order("created_at", { ascending: false })
      .limit(20);
    initialInsights = (data as AiInsight[]) ?? [];
  }

  return (
    <AiAccessGate userProfile={userProfile}>
      <AiChatClient initialInsights={initialInsights} />
    </AiAccessGate>
  );
}
