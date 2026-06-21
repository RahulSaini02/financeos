import { createServerClient } from '@supabase/ssr'
import UsersTable, { AdminUser } from '@/components/admin/UsersTable'

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

export default async function AdminUsersPage() {
  const serviceClient = createServiceRoleClient()

  const [profilesRes, authUsersRes] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('id, role, email_verified, ai_enabled, ai_access_requested_at, ai_access_requested_reason, created_at')
      .order('created_at', { ascending: false }),
    serviceClient.auth.admin.listUsers(),
  ])

  const profiles = profilesRes.data ?? []
  const authUsers = authUsersRes.data?.users ?? []
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))

  const users: AdminUser[] = profiles.map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? '',
    role: p.role as 'admin' | 'user',
    email_verified: p.email_verified,
    ai_enabled: p.ai_enabled,
    ai_access_requested_at: p.ai_access_requested_at,
    ai_access_requested_reason: p.ai_access_requested_reason,
    created_at: p.created_at,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Users</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">Manage user accounts and permissions</p>
      <UsersTable users={users} />
    </div>
  )
}
