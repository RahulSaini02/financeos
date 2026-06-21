import { RefreshCw, Calculator, Target, TrendingUp, BrainCircuit } from "lucide-react";

// ── CSS UI Mockups ─────────────────────────────────────────────────────────────

function DashboardMockup() {
  const bars = [40, 55, 48, 62, 70, 58, 75, 90];
  const accounts = [
    { name: "Checking", amount: "$12,450", color: "bg-blue-500" },
    { name: "High-Yield Savings", amount: "$28,000", color: "bg-green-500" },
    { name: "Chase Sapphire", amount: "−$6,165", color: "bg-purple-500", neg: true },
  ];

  return (
    <div className="w-full bg-[var(--color-bg-primary)] font-sans select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] tracking-wide uppercase">Dashboard</span>
        <span className="text-[11px] text-[var(--color-text-muted)]">Nov 2025</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Net worth */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Net Worth</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">$47,284.50</p>
          </div>
          <span className="text-xs font-semibold text-[var(--color-success)] mb-0.5">↑ 2.7%</span>
        </div>

        {/* Mini bar chart */}
        <div className="flex items-end gap-1 h-10">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${h}%`,
                background: i === bars.length - 1
                  ? "var(--color-accent)"
                  : "color-mix(in srgb, var(--color-accent) 35%, transparent)",
              }}
            />
          ))}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Income", value: "$5,240", color: "text-[var(--color-success)]" },
            { label: "Expenses", value: "$3,812", color: "text-[var(--color-danger)]" },
            { label: "Saved", value: "$1,428", color: "text-[var(--color-text-primary)]" },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--color-bg-secondary)] rounded-lg p-2 text-center">
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Account list */}
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${a.color} shrink-0`} />
                <span className="text-[11px] text-[var(--color-text-secondary)]">{a.name}</span>
              </div>
              <span className={`text-[11px] font-semibold ${a.neg ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]"}`}>
                {a.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BudgetsMockup() {
  const budgets = [
    { label: "Food & Dining", spent: 340, limit: 400, pct: 85, color: "bg-[var(--color-warning)]" },
    { label: "Entertainment", spent: 210, limit: 300, pct: 70, color: "bg-[var(--color-success)]" },
    { label: "Shopping", spent: 520, limit: 500, pct: 100, color: "bg-[var(--color-danger)]", over: true },
    { label: "Transport", spent: 85, limit: 200, pct: 42, color: "bg-[var(--color-success)]" },
  ];

  return (
    <div className="w-full bg-[var(--color-bg-primary)] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] tracking-wide uppercase">Budgets</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-success)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
          4 of 6 on track
        </span>
      </div>

      <div className="p-4 space-y-3.5">
        {budgets.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-[var(--color-text-secondary)]">{b.label}</span>
              <span className={`text-[10px] font-semibold ${b.over ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}`}>
                ${b.spent} / ${b.limit}
                {b.over && " ⚠"}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${b.color}`}
                style={{ width: `${Math.min(b.pct, 100)}%` }}
              />
            </div>
          </div>
        ))}

        {/* Summary row */}
        <div className="pt-1 mt-1 border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-text-muted)]">Total spent this month</span>
          <span className="text-[11px] font-bold text-[var(--color-text-primary)]">$1,155 / $1,400</span>
        </div>
      </div>
    </div>
  );
}

function AIChatMockup() {
  return (
    <div className="w-full bg-[var(--color-bg-primary)] font-sans select-none">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
        <BrainCircuit className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">FinanceOS AI</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-success)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
          live
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* User bubble */}
        <div className="flex justify-end">
          <div className="bg-[var(--color-accent)]/20 text-[var(--color-text-primary)] text-[11px] rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
            How am I doing this month compared to last?
          </div>
        </div>

        {/* AI bubble */}
        <div className="flex justify-start">
          <div className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-[11px] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[88%] space-y-1">
            <p>You&apos;ve spent <span className="text-[var(--color-text-primary)] font-semibold">$1,842</span> vs <span className="font-semibold">$2,200</span> last month — down 16%.</p>
            <p>Savings rate is <span className="text-[var(--color-success)] font-semibold">27%</span>, up from 18%. Great progress!</p>
          </div>
        </div>

        {/* User bubble 2 */}
        <div className="flex justify-end">
          <div className="bg-[var(--color-accent)]/20 text-[var(--color-text-primary)] text-[11px] rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
            Where am I overspending?
          </div>
        </div>

        {/* AI bubble 2 */}
        <div className="flex justify-start">
          <div className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-[11px] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[88%]">
            Shopping is over budget by <span className="text-[var(--color-danger)] font-semibold">$20</span>. Want me to set a tighter limit for December?
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl px-3 py-2">
          <span className="text-[11px] text-[var(--color-text-muted)] flex-1">Ask anything about your finances…</span>
          <span className="w-5 h-5 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white text-[10px]">↑</span>
        </div>
      </div>
    </div>
  );
}

// ── Feature cards data ─────────────────────────────────────────────────────────

const featureRows = [
  {
    tag: "Dashboard",
    heading: "Your full financial picture",
    body: "See every account, every dollar, and your net worth trend at a glance. FinanceOS surfaces what matters — flagged transactions, budget warnings, and upcoming bills.",
    bullets: [
      "Net worth tracking across all accounts",
      "Monthly income vs. expense snapshot",
      "Flagged unusual transactions",
      "Upcoming bill reminders",
    ],
    Mockup: DashboardMockup,
  },
  {
    tag: "Budgets",
    heading: "Budgets that actually work",
    body: "Set spending limits by category, track progress in real time, and get alerted before you overspend. Finally, budgets that bend to your life.",
    bullets: [
      "Category-based limits",
      "Real-time progress bars",
      "Overspend alerts",
      "Monthly vs YTD view",
    ],
    Mockup: BudgetsMockup,
  },
  {
    tag: "AI Agent",
    heading: "AI that knows your money",
    body: "Ask anything, get real answers. The AI reads your actual transaction history and gives specific, actionable insights — not generic advice.",
    bullets: [
      "Natural language Q&A",
      "Anomaly detection",
      "Savings goal nudges",
      "Personalized weekly review",
    ],
    Mockup: AIChatMockup,
  },
];

const secondary = [
  {
    icon: RefreshCw,
    title: "Subscriptions",
    description: "Track every recurring charge. Never miss a renewal or surprise charge again.",
  },
  {
    icon: Calculator,
    title: "Tax Estimator",
    description: "Estimate your federal tax liability at any point in the year.",
  },
  {
    icon: Target,
    title: "Savings Goals",
    description: "Set goals, track deposits, and get AI nudges when you fall behind.",
  },
  {
    icon: TrendingUp,
    title: "Investments",
    description: "Log and monitor your investment portfolio alongside your accounts.",
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="bg-[var(--color-bg-primary)]">
      {/* Section heading */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-16 text-center">
        <p className="text-xs tracking-widest uppercase text-[var(--color-text-muted)] mb-3">
          Features
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">
          Your entire financial life, in one place
        </h2>
        <p className="text-[var(--color-text-secondary)] mt-3 max-w-xl mx-auto">
          From daily spending to savings goals to tax estimates — it&apos;s all here.
        </p>
      </div>

      {/* Feature card grid — 3 columns on desktop */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featureRows.map(({ tag, heading, body, bullets, Mockup }) => (
            <div
              key={tag}
              className="flex flex-col bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl overflow-hidden hover:border-[var(--color-accent)]/30 transition-colors group"
            >
              {/* CSS UI mockup — fixed height so all three cards match */}
              <div className="h-[260px] overflow-hidden border-b border-[var(--color-border)] group-hover:opacity-90 transition-opacity">
                <Mockup />
              </div>

              {/* Text content */}
              <div className="p-6 flex flex-col flex-1">
                <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--color-accent)] mb-2">
                  {tag}
                </span>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">
                  {heading}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed flex-1">
                  {body}
                </p>
                <ul className="space-y-1.5">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                      <span className="text-[var(--color-success)] mt-0.5 shrink-0">✓</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary 4-card mini-grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {secondary.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/60 rounded-2xl p-6 hover:border-[var(--color-accent)]/30 transition-colors"
            >
              <div className="rounded-xl bg-[var(--color-accent)]/10 p-2.5 w-fit mb-4">
                <Icon className="h-5 w-5 text-[var(--color-accent)]" />
              </div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                {title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
