import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import EmployersClient from "./employers-page-client";
import type { Employer, Account } from "@/lib/types";

export default async function EmployersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: employersData }, { data: accountsData }] = await Promise.all([
    supabase.from("employers").select("*").eq("user_id", user.id).order("name"),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("type", ["checking", "savings"])
      .order("name"),
  ]);

  return (
    <Suspense fallback={<GridPageSkeleton cards={3} />}>
      <EmployersClient
        initialEmployers={(employersData as Employer[]) ?? []}
        initialAccounts={(accountsData as Account[]) ?? []}
        userId={user.id}
      />
    </Suspense>
  );
}
