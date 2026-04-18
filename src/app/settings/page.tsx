import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const initialName: string = user.user_metadata?.full_name ?? "";
  const email: string = user.email ?? "";

  return <SettingsClient initialName={initialName} email={email} />;
}
