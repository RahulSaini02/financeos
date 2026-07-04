import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { executeWriteTool } from '@/lib/agent-tools'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as {
      action_id?: unknown
      confirmed?: unknown
      timezone?: unknown
    } | null

    if (!body || typeof body.action_id !== 'string' || !body.action_id || typeof body.confirmed !== 'boolean') {
      return NextResponse.json(
        { error: 'action_id (string) and confirmed (boolean) are required' },
        { status: 400 },
      )
    }
    const { action_id, confirmed } = body
    const tz = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'America/Los_Angeles'

    // Fetch the pending action — must belong to this user
    const { data: actionRow, error: fetchError } = await supabase
      .from('agent_action_log')
      .select('id, user_id, tool_name, input_json, status')
      .eq('id', action_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !actionRow) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    if (actionRow.status !== 'pending') {
      return NextResponse.json(
        { error: `Action is already ${actionRow.status}, cannot confirm` },
        { status: 400 },
      )
    }

    if (!confirmed) {
      // Atomic pending → rejected: the status predicate makes concurrent
      // confirms/cancels race-safe — only one request wins the transition
      const { data: claimed } = await supabase
        .from('agent_action_log')
        .update({ status: 'rejected' })
        .eq('id', action_id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .select('id')

      if (!claimed?.length) {
        return NextResponse.json({ error: 'Action was already processed' }, { status: 400 })
      }
      return NextResponse.json({ success: true, result: 'Action cancelled.' })
    }

    // Atomically claim pending → executed BEFORE running the tool, so a
    // concurrent duplicate confirm cannot execute the write twice. A tool
    // failure downgrades the status to 'failed' afterwards.
    const { data: claimed } = await supabase
      .from('agent_action_log')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('id', action_id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select('id')

    if (!claimed?.length) {
      return NextResponse.json({ error: 'Action was already processed' }, { status: 400 })
    }

    // Execute the write tool
    const result = await executeWriteTool(
      actionRow.tool_name,
      actionRow.input_json as Record<string, unknown>,
      user.id,
      supabase,
      tz,
    )

    // Record the result; downgrade status if the executor reported failure
    const finalStatus = result.summary.startsWith('Failed:') ? 'failed' : 'executed'

    await supabase
      .from('agent_action_log')
      .update({
        status: finalStatus,
        result_json: { text: result.text, summary: result.summary },
      })
      .eq('id', action_id)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: finalStatus === 'executed',
      result: result.text,
      summary: result.summary,
    })
  } catch (err) {
    console.error('AI Agent confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
