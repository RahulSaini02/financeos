import { AppShell } from "@/components/ui/app-shell";
import { OfflineBanner } from "@/components/ui/offline-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <OfflineBanner />
      {children}
    </AppShell>
  );
}
