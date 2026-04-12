import Link from "next/link";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] mb-4 text-[var(--color-text-muted)]">
        {icon}
      </div>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
      {description && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
