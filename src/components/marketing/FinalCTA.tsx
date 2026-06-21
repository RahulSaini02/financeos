import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] py-24">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold text-[var(--color-text-primary)]">
          Ready to finally understand your money?
        </h2>
        <p className="text-[var(--color-text-secondary)] mt-4">
          No credit card. No bank connection required. Get started in under a
          minute.
        </p>

        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Link
            href="/login?signup=true"
            className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Start for free →
          </Link>
          <Link
            href="/login"
            className="border border-[var(--color-border)] text-[var(--color-text-secondary)] px-6 py-3 rounded-xl hover:bg-[var(--color-bg-primary)] transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-6 text-xs text-[var(--color-text-muted)] flex gap-4 justify-center flex-wrap">
          <Link href="/privacy" className="hover:text-[var(--color-text-secondary)] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[var(--color-text-secondary)] transition-colors">
            Terms
          </Link>
          <span>Built with Claude AI</span>
        </div>
      </div>
    </section>
  );
}
