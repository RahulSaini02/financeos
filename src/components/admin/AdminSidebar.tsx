"use client";

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, BrainCircuit, Settings2 } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, href: '/admin/overview' },
  { label: 'Users',    icon: Users,           href: '/admin/users' },
  { label: 'AI Usage', icon: BrainCircuit,    href: '/admin/ai-requests' },
  { label: 'Settings', icon: Settings2,       href: '/admin/settings' },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  // On mobile the global AppShell bottom nav already shows admin-specific tabs —
  // so we only render the sidebar on md+ screens.
  return (
    <aside className="hidden md:flex md:flex-col w-52 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
      <p className="px-3 py-2 text-xs font-semibold tracking-widest uppercase text-[var(--color-text-muted)] mb-2">
        Admin
      </p>
      <nav className="space-y-0.5">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
