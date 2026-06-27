"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface EndpointDataPoint {
  name: string;
  value: number;
  color: string;
}

interface AdminAiEndpointChartProps {
  data: EndpointDataPoint[];
  total: number;
}

function EndpointTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: EndpointDataPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-[var(--color-text-primary)]">{d.payload.name}</p>
      <p className="text-[var(--color-text-muted)]">
        <span className="font-medium" style={{ color: d.payload.color }}>{d.value}</span> calls
      </p>
    </div>
  );
}

export default function AdminAiEndpointChart({ data, total }: AdminAiEndpointChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">AI Usage by Endpoint</h3>
        <p className="text-xs text-[var(--color-text-muted)]">No AI calls in the last 7 days</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        AI Usage by Endpoint
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">{total} calls (7d)</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<EndpointTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[var(--color-text-muted)]">{d.name}</span>
            <span className="font-medium text-[var(--color-text-primary)]">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
