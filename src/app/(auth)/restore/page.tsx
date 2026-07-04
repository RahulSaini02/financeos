import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { RestoreClient } from "./RestoreClient";

// Server page — reading the wall clock here is deliberate (recovery-window check)
function isPast(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() < Date.now();
}

export default async function RestorePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("deleted_at, deletion_scheduled")
    .eq("id", user.id)
    .single();

  // Not soft-deleted (or pre-migration) — nothing to restore
  if (!profile?.deleted_at) redirect("/dashboard");

  // Past the recovery window: the purge cron will remove the account; don't offer restore
  const windowExpired = isPast((profile.deletion_scheduled as string | null) ?? null);

  return (
    <RestoreClient
      deletedAt={profile.deleted_at as string}
      deletionScheduled={(profile.deletion_scheduled as string | null) ?? null}
      windowExpired={windowExpired}
    />
  );
}
