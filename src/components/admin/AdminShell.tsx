"use client";

import AdminSidebar from './AdminSidebar'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6 bg-[var(--color-bg-primary)] pb-6">
        {children}
      </main>
    </div>
  )
}
