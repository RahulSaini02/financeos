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

  // Pre-fetch user's active custom prompts (and model preference) for hydration
  const { data: promptsData } = await supabase
    .from("user_prompts")
    .select("prompt_key, content, version")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const allRows = promptsData ?? [];
  const modelRow = allRows.find((p) => p.prompt_key === "ai_model");
  const initialModel = (modelRow?.content as string) ?? "claude-haiku-4-5-20251001";

  const initialPrompts = allRows
    .filter((p) => p.prompt_key !== "ai_model")
    .map((p) => ({
      prompt_key: p.prompt_key as string,
      content: p.content as string,
      version: p.version as number,
    }));

  return (
    <SettingsClient
      initialName={initialName}
      email={email}
      initialPrompts={initialPrompts}
      initialModel={initialModel}
    />
  );
}
