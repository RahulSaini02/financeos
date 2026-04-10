import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn("flex items-center justify-between mb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: CardProps) {
  return (
    <h3
      className={cn("text-sm font-medium text-[var(--color-text-secondary)]", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardValue({ children, className, ...props }: CardProps) {
  return (
    <p
      className={cn("text-2xl font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}

export function CardChange({ children, positive, className, ...props }: CardProps & { positive?: boolean }) {
  return (
    <span
      className={cn(
        "text-xs font-medium",
        positive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
