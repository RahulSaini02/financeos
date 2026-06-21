import { Layers, BrainCircuit, Lock, Ban } from "lucide-react";

const items = [
  { icon: Layers, label: "13 financial modules" },
  { icon: BrainCircuit, label: "Claude AI built in" },
  { icon: Lock, label: "100% private" },
  { icon: Ban, label: "$0 ads, ever" },
];

export default function TrustBar() {
  return (
    <div className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-center gap-8 sm:gap-16 flex-wrap">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Icon className="h-4 w-4 text-[var(--color-accent)]" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
