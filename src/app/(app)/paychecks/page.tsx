import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { PaychecksClient } from "./PaychecksClient";
import type { Paycheck, Employer } from "@/lib/types";

export default async function PaychecksPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: paychecks }, { data: employers }] = await Promise.all([
    supabase
      .from("paychecks")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase
      .from("employers")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <PaychecksClient
      initialPaychecks={(paychecks ?? []) as Paycheck[]}
      employers={(employers ?? []) as Employer[]}
    />
  );
}
