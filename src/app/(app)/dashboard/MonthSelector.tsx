"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface MonthSelectorProps {
  selectedMonth: string; // "YYYY-MM"
  availableMonths: string[]; // sorted desc, "YYYY-MM"
}

export function MonthSelector({ selectedMonth, availableMonths }: MonthSelectorProps) {
  const router = useRouter();

  const currentMonth = availableMonths[0];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === currentMonth) router.push("/dashboard");
    else router.push(`/dashboard?month=${val}`);
  };

  const formatLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="relative flex items-center">
      <select
        value={selectedMonth}
        onChange={handleChange}
        className="appearance-none text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg pl-3 pr-7 py-1.5 text-[var(--color-text-primary)] cursor-pointer hover:border-[var(--color-accent)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      >
        {availableMonths.map((ym) => (
          <option key={ym} value={ym}>
            {formatLabel(ym)}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-[var(--color-text-muted)] pointer-events-none" />
    </div>
  );
}
