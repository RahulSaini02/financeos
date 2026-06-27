import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminStatCard from '@/components/admin/AdminStatCard'
import { Users, BrainCircuit, Clock, Shield } from 'lucide-react'

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const [totalUsersRes, pendingAiAccessRes, approvedAiAccessRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('ai_enabled', false).not('ai_access_requested_at', 'is', null),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('ai_enabled', true),
  ])

  const totalUsers = totalUsersRes.count ?? 0
  const pendingAiAccess = pendingAiAccessRes.count ?? 0
  const approvedAiAccess = approvedAiAccessRes.count ?? 0

  const now = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Overview</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">FinanceOS admin dashboard</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <AdminStatCard icon={Users} label="Total Users" value={totalUsers} />
        <AdminStatCard icon={BrainCircuit} label="AI Enabled" value={approvedAiAccess} />
        <AdminStatCard icon={Clock} label="Pending Requests" value={pendingAiAccess} />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Admin Session</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
            <Shield className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Logged in as Admin</p>
            <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{now}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
