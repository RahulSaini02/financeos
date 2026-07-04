import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const RECOVERY_WINDOW_DAYS = 30;

// Soft-delete: mark the account for deletion and keep all data for 30 days.
// The user is signed out client-side after this returns; on re-login within
// the window they choose Restore or Fresh Start (see /api/user/restore).
// Hard deletion happens only via the purge cron or an explicit fresh start.
export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deletedAt = new Date();
  const purgeAt = new Date(deletedAt.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      deleted_at: deletedAt.toISOString(),
      deletion_scheduled: purgeAt.toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Revoke every session server-side so retained tokens can't keep hitting the
  // API until natural expiry; the client's local signOut only clears this device.
  await supabase.auth.signOut({ scope: "global" });

  return NextResponse.json({
    success: true,
    deletion_scheduled: purgeAt.toISOString(),
    recovery_window_days: RECOVERY_WINDOW_DAYS,
  });
}
