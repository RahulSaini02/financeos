import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AppShell } from "@/components/ui/app-shell";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { BaseCurrencyProvider } from "@/lib/currency-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Single choke point for post-login routing: soft-deleted accounts go to the
  // restore prompt; first-time users go through onboarding. Middleware already
  // guarantees an authenticated user on these routes.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("deleted_at, onboarding_completed_at")
      .eq("id", user.id)
      .single();

    // error → columns may not exist pre-migration (031/032); skip gating
    if (!error && profile) {
      if (profile.deleted_at) redirect("/restore");
      if (!profile.onboarding_completed_at) redirect("/onboarding");
    }
  }

  return (
    <BaseCurrencyProvider>
      <>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            {/* Preconnect only on authenticated pages that actively use Supabase */}
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
        <AppShell>
          <OfflineBanner />
          {children}
        </AppShell>
      </>
    </BaseCurrencyProvider>
  );
}
