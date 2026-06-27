"use client";

import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BrainCircuit, Settings2, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SectionDef {
  label: string
  icon: LucideIcon
}

const SECTION_MAP: Record<string, SectionDef> = {
  '/admin/overview':     { label: 'Overview', icon: LayoutDashboard },
  '/admin/users':        { label: 'Users',    icon: Users },
  '/admin/ai-requests':  { label: 'AI Usage', icon: BrainCircuit },
  '/admin/settings':     { label: 'Settings', icon: Settings2 },
}

export default function AdminMobileHeader() {
  const pathname = usePathname()
  const section: SectionDef = SECTION_MAP[pathname] ?? { label: 'Admin', icon: ShieldCheck }
  const Icon = section.icon

  return (
    <div className="flex items-center gap-2 mb-5 md:hidden">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
        <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-[var(--color-text-muted)]">Admin</span>
        <span className="text-[var(--color-text-muted)]">/</span>
        <span className="font-semibold text-[var(--color-text-secondary)]">{section.label}</span>
      </div>
    </div>
  )
}
