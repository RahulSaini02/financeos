import { AppShell } from "@/components/ui/app-shell";
import { OfflineBanner } from "@/components/ui/offline-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
