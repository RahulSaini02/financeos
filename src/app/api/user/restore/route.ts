import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

// Re-login decision for a soft-deleted account (within the 30-day window):
//   { action: "restore" }     → clear deleted_at, all data intact
//   { action: "fresh_start" } → hard-delete the auth user; FK cascades purge all data
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: unknown;
  try {
    const body = (await request.json()) as { action?: unknown };
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (action !== "restore" && action !== "fresh_start") {
    return NextResponse.json(
      { error: "action must be 'restore' or 'fresh_start'" },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile?.deleted_at) {
    return NextResponse.json({ error: "Account is not scheduled for deletion" }, { status: 400 });
  }

  if (action === "restore") {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ deleted_at: null, deletion_scheduled: null })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, restored: true });
  }

  // Fresh start: deleting from auth.users cascades to profiles and every
  // user-scoped table (all FK to profiles with on delete cascade).
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: true });
}
