"use client";

import Link from "next/link";
import { BrainCircuit } from "lucide-react";

export default function MarketingNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-[var(--color-bg-primary)]/80 border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-[var(--color-accent)]" />
          <span className="font-bold text-lg text-[var(--color-text-primary)]">
            FinanceOS
          </span>
        </Link>

        {/* Nav actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login?signup=true"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
