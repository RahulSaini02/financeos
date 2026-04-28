import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AccountsPageSkeleton } from "@/components/ui/skeleton";
import AccountsClient from "./accounts-page-client";
import type { Account } from "@/lib/types";

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  return (
    <Suspense fallback={<AccountsPageSkeleton />}>
      <AccountsClient
        initialAccounts={(data as Account[]) ?? []}
        userId={user.id}
      />
    </Suspense>
  );
}
