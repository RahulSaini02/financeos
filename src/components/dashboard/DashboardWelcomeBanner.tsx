import Link from "next/link";
import { Wallet, Upload, Target } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: Wallet,
    title: "Add your accounts",
    description: "Track balances across checking, savings, credit cards, and more.",
    href: "/accounts",
    label: "Add accounts",
  },
  {
    num: "02",
    icon: Upload,
    title: "Import transactions",
    description: "Import from CSV or paste bank statements — FinanceOS categorizes automatically.",
    href: "/import",
    label: "Import now",
  },
  {
    num: "03",
    icon: Target,
    title: "Set up budgets",
    description: "Create spending limits per category and track progress in real time.",
    href: "/budgets",
    label: "Create budgets",
  },
];

export function DashboardWelcomeBanner() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden mb-6">
      <div className="h-0.5 w-full bg-gradient-to-r from-[var(--color-accent)]/50 via-[var(--color-warning)]/30 to-transparent" />
      <div className="p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest uppercase text-[var(--color-accent)] mb-1">
            ✦ Welcome to FinanceOS
          </p>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Get started in 3 steps
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Your dashboard will come alive once you add your financial data.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map(({ num, icon: Icon, title, description, href, label }) => (
            <div
              key={num}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-[var(--color-text-muted)]/40 leading-none">
                  {num}
                </span>
                <div className="rounded-lg bg-[var(--color-accent)]/10 p-2">
                  <Icon className="h-4 w-4 text-[var(--color-accent)]" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{description}</p>
              </div>
              <Link
                href={href}
                className="text-xs font-medium text-[var(--color-accent)] hover:underline mt-auto"
              >
                {label} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
