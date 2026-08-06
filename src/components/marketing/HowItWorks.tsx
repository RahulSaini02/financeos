import { Upload, BarChart3, BrainCircuit } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Add your accounts",
    body: "Import from CSV, paste transaction history, or add accounts manually. MyFinOS handles the categorization automatically.",
  },
  {
    number: "02",
    icon: BarChart3,
    title: "Everything tracked automatically",
    body: "Budgets fill in, subscriptions surface, savings goals update in real time. One dashboard for your entire financial life.",
  },
  {
    number: "03",
    icon: BrainCircuit,
    title: "Ask the AI anything",
    body: "\"How much did I spend on dining?\" \"Am I on track for my savings goal?\" Your AI agent knows your full financial picture.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 border-t border-[var(--color-border)]/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <div className="text-center">
          <p className="text-xs tracking-widest uppercase text-[var(--color-text-muted)] mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">
            Up and running in minutes
          </h2>
          <p className="text-[var(--color-text-secondary)] mt-3 max-w-xl mx-auto">
            No bank sync required. No subscription fees. Just your finances,
            finally organized.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {steps.map(({ number, icon: Icon, title, body }) => (
            <div
              key={number}
              className="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 hover:border-[var(--color-accent)]/30 transition-colors overflow-hidden"
            >
              {/* Top accent gradient line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/50 to-transparent" />

              {/* Large gradient number */}
              <p className="text-7xl font-black bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] bg-clip-text text-transparent opacity-30 mb-4 leading-none">
                {number}
              </p>

              {/* Icon */}
              <div className="rounded-xl bg-[var(--color-accent)]/10 p-2.5 w-fit mb-4">
                <Icon className="h-5 w-5 text-[var(--color-accent)]" />
              </div>

              <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
                {title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
