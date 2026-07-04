import { createServerSupabaseClient } from '@/lib/supabase-server'
import AiUsagePanel, { type UserUsageRow } from '@/components/admin/AiUsagePanel'

export default async function AdminAiUsagePage() {
  const supabase = await createServerSupabaseClient()

  const now = new Date()
  const todayMidnight = new Date(now)
  todayMidnight.setUTCHours(0, 0, 0, 0)
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  const [todayRes, weekRes, capRes] = await Promise.all([
    supabase
      .from('ai_usage_log')
      .select('user_id, cost_usd')
      .gte('created_at', todayMidnight.toISOString()),
    supabase
      .from('ai_usage_log')
      .select('user_id, endpoint')
      .gte('created_at', weekAgo),
    supabase.from('app_settings').select('value').eq('key', 'ai_daily_cost_cap_usd').maybeSingle(),
  ])

  const parsedCap = Number(capRes.data?.value)
  const costCap = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 0.75

  const todayCounts: Record<string, number> = {}
  const todayCosts: Record<string, number> = {}
  for (const row of todayRes.data ?? []) {
    todayCounts[row.user_id] = (todayCounts[row.user_id] ?? 0) + 1
    todayCosts[row.user_id] = (todayCosts[row.user_id] ?? 0) + Number(row.cost_usd ?? 0)
  }
  const weekCounts: Record<string, number> = {}
  for (const row of weekRes.data ?? []) {
    weekCounts[row.user_id] = (weekCounts[row.user_id] ?? 0) + 1
  }

  const activeUserIds = [...new Set([...Object.keys(todayCounts), ...Object.keys(weekCounts)])]

  let profiles: { id: string; email: string | null; full_name: string | null }[] = []
  if (activeUserIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', activeUserIds)
    profiles = data ?? []
  }

  const rows: UserUsageRow[] = profiles
    .map((p) => ({
      id: p.id,
      email: p.email ?? '',
      full_name: p.full_name ?? null,
      today: todayCounts[p.id] ?? 0,
      week: weekCounts[p.id] ?? 0,
      costToday: todayCosts[p.id] ?? 0,
    }))
    .sort((a, b) => b.costToday - a.costToday || b.today - a.today)

  const totalToday = Object.values(todayCounts).reduce((s, n) => s + n, 0)
  const totalWeek = Object.values(weekCounts).reduce((s, n) => s + n, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">AI Usage</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Monitor AI call volume across all users
      </p>
      <AiUsagePanel rows={rows} totalToday={totalToday} totalWeek={totalWeek} costCap={costCap} />
    </div>
  )
}
