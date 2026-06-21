import type { LucideIcon } from 'lucide-react'

interface AdminStatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  accent?: boolean
}

export default function AdminStatCard({ icon: Icon, label, value, accent }: AdminStatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="p-2 rounded-lg bg-[var(--color-accent)]/10">
          <Icon size={18} className="text-[var(--color-accent)]" />
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
        {value}
      </p>
    </div>
  )
}
