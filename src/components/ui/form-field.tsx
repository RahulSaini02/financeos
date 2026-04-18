import { cn } from "@/lib/utils";

// ── FormField ─────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
        {required && (
          <span className="text-[var(--color-danger)] ml-0.5">*</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[var(--color-danger)] mt-1">{error}</p>
      )}
    </div>
  );
}

// ── Shared base class ─────────────────────────────────────────────────────────

const inputBase =
  "w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]";

// ── FormInput ─────────────────────────────────────────────────────────────────

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
}

export function FormInput({ prefix, className, ...props }: FormInputProps) {
  if (prefix) {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)] pointer-events-none select-none">
          {prefix}
        </span>
        <input
          className={cn(inputBase, "pl-7", className)}
          {...props}
        />
      </div>
    );
  }
  return <input className={cn(inputBase, className)} {...props} />;
}

// ── FormSelect ────────────────────────────────────────────────────────────────

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function FormSelect({ className, children, ...props }: FormSelectProps) {
  return (
    <select className={cn(inputBase, className)} {...props}>
      {children}
    </select>
  );
}

// ── FormTextarea ──────────────────────────────────────────────────────────────

type FormTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function FormTextarea({ className, ...props }: FormTextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] placeholder:text-[var(--color-text-muted)] resize-none",
        className
      )}
      {...props}
    />
  );
}
