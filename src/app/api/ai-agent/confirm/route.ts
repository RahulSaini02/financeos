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

    // ── AI access guard ───────────────────────────────────────────────────
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('ai_enabled')
      .eq('id', user.id)
      .maybeSingle()

    if (!profileRow?.ai_enabled) {
      return NextResponse.json(
        { error: 'AI access not enabled', code: 'AI_DISABLED' },
        { status: 403 },
      )
    }

    const body = await request.json() as { action_id: string; confirmed: boolean }
    const { action_id, confirmed } = body

    if (!action_id || typeof action_id !== 'string') {
      return NextResponse.json({ error: 'action_id is required' }, { status: 400 })
    }

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
      // Rejected — mark as rejected
      await supabase
        .from('agent_action_log')
        .update({ status: 'rejected' })
        .eq('id', action_id)
        .eq('user_id', user.id)

      return NextResponse.json({ success: true, result: 'Action cancelled.' })
    }

    // Execute the write tool
    const result = await executeWriteTool(
      actionRow.tool_name,
      actionRow.input_json as Record<string, unknown>,
      user.id,
      supabase,
    )

    // Determine final status based on whether the result indicates failure
    const finalStatus = result.summary.startsWith('Failed:') ? 'failed' : 'executed'

    await supabase
      .from('agent_action_log')
      .update({
        status: finalStatus,
        result_json: { text: result.text, summary: result.summary },
        executed_at: new Date().toISOString(),
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
