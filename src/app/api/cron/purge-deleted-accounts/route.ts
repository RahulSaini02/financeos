import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Called daily by Vercel Cron. Permanently removes accounts whose 30-day
// recovery window has ended (profiles.deletion_scheduled in the past).
// Deleting the auth user cascades to profiles and every user-scoped table.
// Requires header: Authorization: Bearer <CRON_SECRET>

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: expired, error } = await supabase
    .from('profiles')
    .select('id, email, deletion_scheduled')
    .not('deletion_scheduled', 'is', null)
    .lt('deletion_scheduled', new Date().toISOString())

  if (error) {
    // Column may not exist until migration 032 runs — treat as nothing to purge
    console.error('purge-deleted-accounts cron: fetch error', error)
    return NextResponse.json({ purged: 0, error: error.message }, { status: 200 })
  }

  let purged = 0
  const failures: Array<{ id: string; error: string }> = []

  for (const profile of expired ?? []) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id)
    if (deleteError) {
      console.error(`purge-deleted-accounts cron: failed to purge ${profile.id}`, deleteError)
      failures.push({ id: profile.id, error: deleteError.message })
    } else {
      purged++
    }
  }

  return NextResponse.json({ purged, failed: failures.length, failures })
}
