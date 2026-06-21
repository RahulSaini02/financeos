import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ChartEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

// Inner content only — always rendered inside a <Card> wrapper by the caller.
export function ChartEmptyState({ icon: Icon, title, description, ctaLabel, ctaHref }: ChartEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="rounded-xl bg-[var(--color-bg-tertiary)] p-3 mb-1">
        <Icon className="h-6 w-6 text-[var(--color-text-muted)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
      <p className="text-xs text-[var(--color-text-muted)] max-w-[200px] leading-relaxed">{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-2 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          {ctaLabel} →
        </Link>
      )}
    </div>
  );
}
