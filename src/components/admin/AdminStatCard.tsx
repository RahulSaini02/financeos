import type { LucideIcon } from 'lucide-react'

interface AdminStatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  accent?: boolean
}

export default function AdminStatCard({ icon: Icon, label, value, accent }: AdminStatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <span className="p-1.5 md:p-2 rounded-lg bg-[var(--color-accent)]/10 shrink-0">
          <Icon size={15} className="text-[var(--color-accent)] md:w-[18px] md:h-[18px]" />
        </span>
        <span className="text-xs md:text-sm text-[var(--color-text-muted)] leading-tight">{label}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-bold ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
        {value}
      </p>
    </div>
  )
}
