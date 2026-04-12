interface PageHeaderProps {
  title: string;
  subtitle?: string;
  tooltip?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  tooltip,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)]">
            {title}
          </h1>
          {tooltip}
        </div>
        {subtitle && (
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {children}
        </div>
      )}
    </div>
  );
}
