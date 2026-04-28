import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email_verified, ai_enabled")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch user stats (counts only)
  const [
    totalUsersRes,
    pendingAiAccessRes,
    approvedAiAccessRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("ai_enabled", false).not("ai_access_requested_at", "is", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("ai_enabled", true),
  ]);

  const stats = {
    totalUsers: totalUsersRes.count ?? 0,
    pendingAiAccess: pendingAiAccessRes.count ?? 0,
    approvedAiAccess: approvedAiAccessRes.count ?? 0,
  };

  // Fetch AI access requests
  const { data: aiRequests } = await supabase
    .from("profiles")
    .select("id, email, full_name, ai_access_requested_at, ai_access_requested_reason")
    .eq("ai_enabled", false)
    .not("ai_access_requested_at", "is", null)
    .order("ai_access_requested_at", { ascending: false });

  return (
    <AdminClient
      userEmail={user.email ?? ""}
      stats={stats}
      aiRequests={aiRequests ?? []}
    />
  );
}
