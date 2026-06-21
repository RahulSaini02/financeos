import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptySectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptySection({ icon: Icon, title, description, ctaLabel, ctaHref }: EmptySectionProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="rounded-xl bg-[var(--color-bg-tertiary)] p-3 mb-1">
        <Icon className="h-8 w-8 text-[var(--color-text-muted)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
      <p className="text-xs text-[var(--color-text-muted)] max-w-[200px] leading-relaxed">{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-3 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          {ctaLabel} →
        </Link>
      )}
    </div>
  );
}
