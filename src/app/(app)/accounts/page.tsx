import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AccountsPageSkeleton } from "@/components/ui/skeleton";
import AccountsClient from "./accounts-page-client";
import type { Account, CurrencyCode } from "@/lib/types";
import { getFxRate } from "@/lib/fx";

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: accountsData }, { data: profileData }] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("profiles")
      .select("default_currency")
      .eq("id", user.id)
      .single(),
  ]);

  const accounts = (accountsData as Account[]) ?? [];
  const baseCurrency: CurrencyCode = (profileData?.default_currency as CurrencyCode) ?? "USD";

  // Collect distinct currencies used across accounts so we only hit the FX
  // service once per unique pair rather than once per account.
  const uniqueCurrencies = [...new Set(accounts.map((a) => a.currency))] as CurrencyCode[];

  const fxRates: Partial<Record<CurrencyCode, number>> = {};
  await Promise.all(
    uniqueCurrencies.map(async (currency) => {
      const rate = await getFxRate(currency, baseCurrency);
      // Fall back to 1 when rate is unavailable — amounts pass through unchanged.
      fxRates[currency] = rate ?? 1;
    })
  );

  return (
    <Suspense fallback={<AccountsPageSkeleton />}>
      <AccountsClient
        initialAccounts={accounts}
        userId={user.id}
        baseCurrency={baseCurrency}
        fxRates={fxRates}
      />
    </Suspense>
  );
}
