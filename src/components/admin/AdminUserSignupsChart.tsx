"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SignupDataPoint {
  date: string;
  label: string;
  count: number;
}

interface AdminUserSignupsChartProps {
  data: SignupDataPoint[];
}

function SignupTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-[var(--color-text-primary)] mb-0.5">{label}</p>
      <p className="text-[var(--color-text-muted)]">
        <span className="font-medium text-[var(--color-accent)]">{payload[0].value}</span>{" "}
        {payload[0].value === 1 ? "signup" : "signups"}
      </p>
    </div>
  );
}

export default function AdminUserSignupsChart({ data }: AdminUserSignupsChartProps) {
  const [range, setRange] = useState<"7d" | "30d">("30d");
  const chartData = range === "7d" ? data.slice(-7) : data;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">User Signups</h3>
        <div className="flex gap-1 rounded-lg bg-[var(--color-bg-tertiary)] p-0.5">
          {(["7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                range === r
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval={range === "30d" ? 4 : 0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<SignupTooltip />} cursor={{ fill: "var(--color-bg-tertiary)" }} />
          <Bar dataKey="count" fill="var(--color-accent)" radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
