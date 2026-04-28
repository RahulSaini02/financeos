import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-text-muted)]">
        <span>© 2026 FinanceOS</span>
        <div className="flex items-center gap-5">
          <Link
            href="/privacy"
            className="hover:text-[var(--color-text-secondary)] transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-[var(--color-text-secondary)] transition-colors"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
