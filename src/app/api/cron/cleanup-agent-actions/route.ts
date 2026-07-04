import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/cron/cleanup-agent-actions
 * Runs daily at 1 AM UTC. Nulls out the messages_state blob on agent_action_log
 * rows whose status is still 'pending' and that were created more than 24 hours
 * ago. This prevents stale unresolved confirm-payloads from accumulating in the
 * database. Status is intentionally left unchanged — 'expired' is not a valid
 * value for the status column (constraint: pending | executed | rejected | failed).
 *
 * Authorize with: Authorization: Bearer <CRON_SECRET>
 * or header: x-cron-secret: <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const auth =
    request.headers.get('authorization')?.replace('Bearer ', '') ??
    request.headers.get('x-cron-secret') ??
    ''

  if (auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Cut-off: anything older than 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('agent_action_log')
    .update({ messages_state: null })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    console.error('[cleanup-agent-actions] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const cleaned = data?.length ?? 0
  console.log(`[cleanup-agent-actions] nulled messages_state on ${cleaned} stale pending rows`)

  return NextResponse.json({ success: true, cleaned })
}
