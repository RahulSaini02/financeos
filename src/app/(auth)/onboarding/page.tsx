import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { OnboardingClient } from "./OnboardingClient";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, deleted_at")
    .eq("id", user.id)
    .single();

  // Pre-migration (031) or already onboarded — nothing to do here
  if (error || profile?.onboarding_completed_at) redirect("/dashboard");
  if (profile?.deleted_at) redirect("/restore");

  return <OnboardingClient userId={user.id} />;
}
