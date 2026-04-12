import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  label: string;
  variant: "success" | "warning" | "danger" | "info" | "muted" | "accent";
  size?: "sm" | "md";
  dot?: boolean;
}

const variantMap: Record<StatusBadgeProps["variant"], string> = {
  success:
    "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  warning:
    "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  danger:
    "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  info:
    "bg-blue-500/15 text-blue-400",
  muted:
    "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]",
  accent:
    "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
};

const dotMap: Record<StatusBadgeProps["variant"], string> = {
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]",
  info: "bg-blue-400",
  muted: "bg-[var(--color-text-muted)]",
  accent: "bg-[var(--color-accent)]",
};

export function StatusBadge({
  label,
  variant,
  size = "md",
  dot = false,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        variantMap[variant],
        size === "sm" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-0.5 text-xs"
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotMap[variant])}
        />
      )}
      {label}
    </span>
  );
}
