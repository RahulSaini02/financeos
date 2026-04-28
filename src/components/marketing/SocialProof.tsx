const stats = [
  { value: "13", label: "Financial modules" },
  { value: "Claude AI", label: "Built-in intelligence" },
  { value: "100%", label: "Private & self-hosted" },
  { value: "$0", label: "Third-party ads" },
];

export default function SocialProof() {
  return (
    <section className="my-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 border-t border-b border-[var(--color-border)]">
        <p className="text-xl text-center text-[var(--color-text-secondary)] mb-12 font-medium">
          Built for people who want clarity, not complexity
        </p>
        <div className="flex flex-wrap justify-center gap-8 sm:gap-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-[var(--color-accent)]">
                {stat.value}
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
