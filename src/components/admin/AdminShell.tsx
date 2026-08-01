"use client";

import AdminSidebar from './AdminSidebar'
import AdminMobileHeader from './AdminMobileHeader'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-full">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-6 bg-[var(--color-bg-primary)]">
        {/* Breadcrumb shown only on mobile since the sidebar covers navigation on desktop */}
        <AdminMobileHeader />
        {children}
      </main>
    </div>
  )
}
