import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold hover:opacity-80 transition-opacity">
            ← FinanceOS
          </Link>
          <Link
            href="/login"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-[var(--color-border)] py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-wrap gap-4 justify-between text-sm text-[var(--color-text-muted)]">
          <span>© 2026 FinanceOS</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[var(--color-text-secondary)] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--color-text-secondary)] transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
