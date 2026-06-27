import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { formatCurrency } from '@/lib/utils'
import AdminStatCard from '@/components/admin/AdminStatCard'
import AdminUserSignupsChart from '@/components/admin/AdminUserSignupsChart'
import AdminAiEndpointChart from '@/components/admin/AdminAiEndpointChart'
import AdminRecentAgentActions from '@/components/admin/AdminRecentAgentActions'
import {
  Users,
  BrainCircuit,
  Shield,
  UserCheck,
  Wallet,
  CreditCard,
  TrendingUp,
  DollarSign,
  Landmark,
  PiggyBank,
  Target,
  Activity,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Upload,
  Database,
  Bot,
  Bell,
  Receipt,
} from 'lucide-react'

function createServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--color-text-muted)] mt-8 mb-3 first:mt-0">
      {title}
    </h2>
  )
}

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const svc = createServiceRoleClient()

  const now = new Date()
  const todayMidnight = new Date(now)
  todayMidnight.setUTCHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  const [
    totalUsersRes,
    aiEnabledRes,
    verifiedUsersRes,
    recentSignupsRes,
    accountBalancesRes,
    activeSubsRes,
    loansRes,
    investmentsRes,
    savingsGoalsRes,
    aiUsageTodayRes,
    aiUsage7dRes,
    aiInsightsTotalRes,
    unreadInsightsRes,
    conversationMsgs7dRes,
    flaggedTxnsRes,
    pendingImportsRes,
    aiCategorizedRes,
    totalTxnsRes,
    agentActionsRecentRes,
    agentPendingRes,
    agentFailed7dRes,
    pushSubsRes,
    memoryFactsRes,
  ] = await Promise.all([
    svc.from('profiles').select('id', { count: 'exact', head: true }),
    svc.from('profiles').select('id', { count: 'exact', head: true }).eq('ai_enabled', true),
    svc.from('profiles').select('id', { count: 'exact', head: true }).eq('email_verified', true),
    svc.from('profiles').select('id, created_at').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
    svc.from('accounts').select('kind, current_balance').eq('is_active', true),
    svc.from('subscriptions').select('billing_cost, billing_cycle_months').eq('status', 'active'),
    svc.from('loans').select('principal, current_balance'),
    svc.from('investments').select('total_invested, current_value'),
    svc.from('savings_goals').select('target_amount, current_amount, status'),
    svc.from('ai_usage_log').select('endpoint').gte('created_at', todayMidnight.toISOString()),
    svc.from('ai_usage_log').select('endpoint').gte('created_at', sevenDaysAgo),
    svc.from('ai_insights').select('id', { count: 'exact', head: true }),
    svc.from('ai_insights').select('id', { count: 'exact', head: true }).eq('is_read', false),
    svc.from('conversation_messages').select('mode').gte('created_at', sevenDaysAgo),
    svc.from('transactions').select('id', { count: 'exact', head: true }).eq('flagged', true),
    svc.from('pending_imports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    svc.from('transactions').select('id', { count: 'exact', head: true }).eq('ai_categorized', true),
    svc.from('transactions').select('id', { count: 'exact', head: true }),
    svc.from('agent_action_log').select('tool_name, status, executed_at, user_id').order('executed_at', { ascending: false }).limit(10),
    svc.from('agent_action_log').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    svc.from('agent_action_log').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('executed_at', sevenDaysAgo),
    svc.from('user_push_subscriptions').select('id', { count: 'exact', head: true }),
    svc.from('user_memory').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  // ── Users ──────────────────────────────────────────────────────────────────
  const totalUsers = totalUsersRes.count ?? 0
  const aiEnabled = aiEnabledRes.count ?? 0
  const verifiedUsers = verifiedUsersRes.count ?? 0
  const aiAdoptionRate = totalUsers > 0 ? Math.round((aiEnabled / totalUsers) * 100) : 0

  // Signups chart — bucket by day for the last 30 days
  const signups = recentSignupsRes.data ?? []
  const newUsersLast7d = signups.filter(
    (s) => new Date(s.created_at).getTime() >= now.getTime() - 7 * 86_400_000,
  ).length
  const signupsByDay: Array<{ date: string; label: string; count: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const dateStr = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const count = signups.filter((s) => s.created_at.slice(0, 10) === dateStr).length
    signupsByDay.push({ date: dateStr, label, count })
  }

  // ── Financial ──────────────────────────────────────────────────────────────
  const accounts = accountBalancesRes.data ?? []
  const totalAssets = accounts
    .filter((a) => a.kind === 'asset' || a.kind === 'investment')
    .reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalLiabilities = accounts
    .filter((a) => a.kind === 'liability')
    .reduce((s, a) => s + Math.abs(a.current_balance ?? 0), 0)
  const platformNetWorth = totalAssets - totalLiabilities

  const subs = activeSubsRes.data ?? []
  const totalMonthlySubs = subs.reduce(
    (s, sub) => s + (sub.billing_cost ?? 0) / (sub.billing_cycle_months || 1),
    0,
  )

  const loans = loansRes.data ?? []
  const totalLoanBalance = loans.reduce((s, l) => s + (l.current_balance ?? 0), 0)

  const investments = investmentsRes.data ?? []
  const totalInvested = investments.reduce((s, i) => s + (i.total_invested ?? 0), 0)
  const currentInvValue = investments.reduce((s, i) => s + (i.current_value ?? 0), 0)
  const invReturn = totalInvested > 0 ? ((currentInvValue - totalInvested) / totalInvested) * 100 : 0

  const goals = savingsGoalsRes.data ?? []
  const activeGoals = goals.filter((g) => g.status === 'active').length
  const completedGoals = goals.filter((g) => g.status === 'completed').length

  // ── AI ─────────────────────────────────────────────────────────────────────
  const aiUsageToday = (aiUsageTodayRes.data ?? []).length
  const aiUsage7dData = aiUsage7dRes.data ?? []
  const aiUsage7d = aiUsage7dData.length

  const endpointCounts = { chat: 0, review: 0, agent: 0 }
  for (const row of aiUsage7dData) {
    const ep = row.endpoint as keyof typeof endpointCounts
    if (ep in endpointCounts) endpointCounts[ep]++
  }
  const endpointChartData = [
    { name: 'Chat', value: endpointCounts.chat, color: '#22c55e' },
    { name: 'Review', value: endpointCounts.review, color: '#6366f1' },
    { name: 'Agent', value: endpointCounts.agent, color: '#f59e0b' },
  ].filter((d) => d.value > 0)

  const totalInsights = aiInsightsTotalRes.count ?? 0
  const unreadInsights = unreadInsightsRes.count ?? 0
  const msgs7d = conversationMsgs7dRes.data ?? []
  const chatMsgs = msgs7d.filter((m) => m.mode === 'chat').length
  const agentMsgs = msgs7d.filter((m) => m.mode === 'agent').length

  // ── Data Quality ───────────────────────────────────────────────────────────
  const flaggedTxns = flaggedTxnsRes.count ?? 0
  const pendingImports = pendingImportsRes.count ?? 0
  const aiCategorized = aiCategorizedRes.count ?? 0
  const totalTxns = totalTxnsRes.count ?? 0
  const categorizationRate = totalTxns > 0 ? Math.round((aiCategorized / totalTxns) * 100) : 0

  // ── System ─────────────────────────────────────────────────────────────────
  const pendingActions = agentPendingRes.count ?? 0
  const failedActions7d = agentFailed7dRes.count ?? 0
  const pushSubscribers = pushSubsRes.count ?? 0
  const memoryFacts = memoryFactsRes.count ?? 0

  const recentActions = agentActionsRecentRes.data ?? []
  const actionUserIds = [...new Set(recentActions.map((a) => a.user_id))]
  let actionUserEmails: Record<string, string> = {}
  if (actionUserIds.length > 0) {
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, email')
      .in('id', actionUserIds)
    actionUserEmails = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.email ?? '']),
    )
  }

  const agentActionRows = recentActions.map((a) => ({
    tool_name: a.tool_name,
    status: a.status as 'pending' | 'executed' | 'rejected' | 'failed',
    executed_at: a.executed_at,
    user_email: actionUserEmails[a.user_id] ?? 'Unknown',
  }))

  const nowFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(now)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Overview</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Platform health &amp; metrics</p>

      {/* ── Users & Growth ────────────────────────────────────────────────── */}
      <SectionHeader title="Users & Growth" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 mb-4">
        <AdminStatCard icon={Users} label="Total Users" value={totalUsers} />
        <AdminStatCard icon={UserCheck} label="Verified" value={verifiedUsers} />
        <AdminStatCard
          icon={BrainCircuit}
          label="AI Enabled"
          value={aiEnabled}
          accent
          subtitle={`${aiAdoptionRate}% adoption`}
        />
        <AdminStatCard icon={Bell} label="Push Subscribers" value={pushSubscribers} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <AdminUserSignupsChart data={signupsByDay} />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Quick Stats</h3>
          <div className="space-y-3">
            {[
              { label: 'New users (7d)', value: newUsersLast7d },
              { label: 'New users (30d)', value: signups.length },
              { label: 'AI memory facts', value: memoryFacts },
              { label: 'Total accounts', value: accounts.length },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">{s.label}</span>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Platform Financial Health ─────────────────────────────────────── */}
      <SectionHeader title="Platform Financial Health" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 mb-3">
        <AdminStatCard icon={Wallet} label="Total Assets" value={formatCurrency(totalAssets)} />
        <AdminStatCard icon={CreditCard} label="Total Liabilities" value={formatCurrency(totalLiabilities)} />
        <AdminStatCard icon={TrendingUp} label="Net Worth" value={formatCurrency(platformNetWorth)} accent />
        <AdminStatCard
          icon={DollarSign}
          label="Monthly Subs"
          value={formatCurrency(totalMonthlySubs)}
          subtitle={`${subs.length} active`}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        <AdminStatCard icon={Landmark} label="Loan Balance" value={formatCurrency(totalLoanBalance)} />
        <AdminStatCard icon={Receipt} label="Total Invested" value={formatCurrency(totalInvested)} />
        <AdminStatCard
          icon={TrendingUp}
          label="Investment Value"
          value={formatCurrency(currentInvValue)}
          subtitle={`${invReturn >= 0 ? '+' : ''}${invReturn.toFixed(1)}% return`}
        />
        <AdminStatCard
          icon={Target}
          label="Savings Goals"
          value={activeGoals}
          subtitle={`${completedGoals} completed`}
        />
      </div>

      {/* ── AI Adoption & Usage ───────────────────────────────────────────── */}
      <SectionHeader title="AI Adoption & Usage" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
        <AdminStatCard icon={Activity} label="AI Calls Today" value={aiUsageToday} />
        <AdminStatCard icon={MessageSquare} label="AI Calls (7d)" value={aiUsage7d} />
        <AdminStatCard
          icon={Lightbulb}
          label="Insights Generated"
          value={totalInsights}
          subtitle={`${unreadInsights} unread`}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <AdminAiEndpointChart data={endpointChartData} total={aiUsage7d} />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 md:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">AI Stats</h3>
          <div className="space-y-3">
            {[
              { label: 'Chat messages (7d)', value: chatMsgs },
              { label: 'Agent messages (7d)', value: agentMsgs },
              { label: 'AI categorization rate', value: `${categorizationRate}%` },
              { label: 'Unread insights', value: unreadInsights },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">{s.label}</span>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Data Quality ──────────────────────────────────────────────────── */}
      <SectionHeader title="Data Quality" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <AdminStatCard
          icon={AlertTriangle}
          label="Flagged Txns"
          value={flaggedTxns}
          accent={flaggedTxns > 0}
        />
        <AdminStatCard icon={Upload} label="Pending Imports" value={pendingImports} />
        <AdminStatCard
          icon={Database}
          label="AI Categorized"
          value={`${categorizationRate}%`}
          subtitle={`${aiCategorized} of ${totalTxns}`}
        />
      </div>

      {/* ── System Activity ───────────────────────────────────────────────── */}
      <SectionHeader title="System Activity" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
        <AdminStatCard icon={Bot} label="Pending Actions" value={pendingActions} />
        <AdminStatCard
          icon={AlertTriangle}
          label="Failed (7d)"
          value={failedActions7d}
          accent={failedActions7d > 0}
        />
        <AdminStatCard icon={PiggyBank} label="Total Transactions" value={totalTxns} />
      </div>
      <AdminRecentAgentActions actions={agentActionRows} />

      {/* ── Admin Session ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 mt-8">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Admin Session</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/10">
            <Shield className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Logged in as Admin</p>
            <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{nowFormatted}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
