"use client";

import AdminSidebar from './AdminSidebar'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6 bg-[var(--color-bg-primary)]">
        {children}
      </main>
    </div>
  )
}
