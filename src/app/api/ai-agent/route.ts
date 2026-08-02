import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_AI_MODEL } from '@/lib/get-user-model'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'
import {
  READ_TOOLS,
  WRITE_TOOLS,
  WRITE_TOOL_NAMES,
} from '@/lib/agent-tools'
import { AUTO_EXECUTE_TOOL_NAMES } from '@/lib/agent-tools'
import { executeWriteTool } from '@/lib/agent/write-tools'
import { createMcpContext, tryParsePending } from '@/lib/mcp/server'
import { buildSafetyPrefix } from '@/lib/agent/safety'
import { checkAndLogAiUsage, recordAiUsageCost, estimateCostUsd } from '@/lib/ai-rate-limit'
import { getCalendarEvents, createCalendarEvent, refreshAccessToken } from '@/lib/google-oauth'
import {
  fetchRecentConversationHistory,
  saveConversationTurn,
  fetchUserPreferences,
  fetchActiveMemories,
  buildMemoryContext,
  extractAndSaveMemories,
} from '@/lib/memory-helpers'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_CLIENT_MESSAGES = 40
const MAX_MESSAGE_CHARS = 16_000
const MAX_ITERATIONS = 8
const STREAM_IDLE_TIMEOUT_MS = 45_000

// Lone surrogate code points (U+D800–U+DFFF) are invalid in JSON and cause a
// 400 from the Anthropic API when present in transaction descriptions or notes.
function sanitizeForJSON<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/[\uD800-\uDFFF]/g, '�') as unknown as T
  if (Array.isArray(value)) return value.map(sanitizeForJSON) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeForJSON(v)])) as unknown as T
  }
  return value
}

// Strict shape validation for client-supplied history. Only plain text
// user/assistant turns are accepted — the client can never inject tool_use,
// tool_result, or other structured blocks into the model conversation.
// Caps length and truncates to a window that starts on a user turn.
function validateClientMessages(raw: unknown): Anthropic.MessageParam[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: Anthropic.MessageParam[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null
    const { role, content } = m as { role?: unknown; content?: unknown }
    if (role !== 'user' && role !== 'assistant') return null
    if (typeof content !== 'string' || content.length === 0 || content.length > MAX_MESSAGE_CHARS) return null
    out.push({ role, content })
  }
  // Merge consecutive same-role turns (the confirm-resume flow can produce
  // back-to-back assistant entries in client history) — the API expects
  // user/assistant alternation
  const merged: Anthropic.MessageParam[] = []
  for (const m of out) {
    const prev = merged[merged.length - 1]
    if (prev && prev.role === m.role) {
      prev.content = `${prev.content as string}\n\n${m.content as string}`
    } else {
      merged.push({ ...m })
    }
  }
  let window = merged.slice(-MAX_CLIENT_MESSAGES)
  const firstUser = window.findIndex((m) => m.role === 'user')
  if (firstUser === -1) return null
  window = window.slice(firstUser)
  if (window[window.length - 1].role !== 'user') return null
  return window
}

// Cap the conversation state persisted for resumption. The window must start
// on a plain-text user turn: starting on a tool_result user turn would orphan
// it from its assistant tool_use turn and the API would reject the resume.
function trimMessagesForState(messages: Anthropic.MessageParam[], keep = 20): Anthropic.MessageParam[] {
  if (messages.length <= keep) return messages
  for (let i = messages.length - keep; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'user' && typeof m.content === 'string') return messages.slice(i)
  }
  return messages
}

interface PendingMessagesState {
  messages: Anthropic.MessageParam[]
  toolUseId: string
  toolName: string
  model: string
  allOtherToolResults: Anthropic.ToolResultBlockParam[]
}

function parseMessagesState(raw: unknown): PendingMessagesState | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null
    const state = parsed as PendingMessagesState
    if (!Array.isArray(state.messages) || typeof state.toolUseId !== 'string') return null
    return {
      messages: state.messages,
      toolUseId: state.toolUseId,
      toolName: typeof state.toolName === 'string' ? state.toolName : '',
      model: typeof state.model === 'string' ? state.model : '',
      allOtherToolResults: Array.isArray(state.allOtherToolResults) ? state.allOtherToolResults : [],
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body = await request.json().catch(() => null) as {
    messages?: unknown
    model?: string
    timezone?: string
    sessionId?: string
    resumeActionId?: string
  } | null

  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { model: requestModel, timezone: clientTimezone, sessionId: bodySessionId, resumeActionId } = body
  const sessionId = typeof bodySessionId === 'string' && bodySessionId ? bodySessionId : crypto.randomUUID()
  const isResume = typeof resumeActionId === 'string' && resumeActionId.length > 0

  // ── Validate input shape (strict — this is the injection boundary) ───────
  let clientMessages: Anthropic.MessageParam[] = []
  if (!isResume) {
    const validated = validateClientMessages(body.messages)
    if (!validated) {
      return new Response(
        JSON.stringify({ error: 'messages must be a non-empty array of { role: "user"|"assistant", content: string } ending with a user turn' }),
        { status: 400 },
      )
    }
    clientMessages = validated
  }

  const userMessages = clientMessages.filter((m) => m.role === 'user')
  const lastUserText = (userMessages[userMessages.length - 1]?.content as string | undefined) ?? ''

  // ── Resume lookup — validate BEFORE consuming rate-limit quota ───────────
  // The replay-guard claim happens later, after the rate limit passes, so a
  // 429 here never burns the one-shot resume state.
  let resumeActionRow: { id: string; tool_name: string; status: string; result_json: unknown; messages_state: unknown } | null = null
  let resumeState: PendingMessagesState | null = null
  if (isResume) {
    const { data: actionRow } = await supabase
      .from('agent_action_log')
      .select('id, tool_name, status, result_json, messages_state')
      .eq('id', resumeActionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!actionRow) {
      return new Response(JSON.stringify({ error: 'Action not found' }), { status: 404 })
    }
    if (actionRow.status === 'pending') {
      return new Response(JSON.stringify({ error: 'Action has not been confirmed yet' }), { status: 400 })
    }
    const state = parseMessagesState(actionRow.messages_state)
    if (!state) {
      return new Response(JSON.stringify({ error: 'Action cannot be resumed' }), { status: 409 })
    }
    resumeActionRow = actionRow
    resumeState = state
  }

  // ── Prompt injection heuristic — canned reply BEFORE consuming quota ─────
  const offTopicPatterns = [
    /ignore (previous|above|all) instructions/i,
    /forget (everything|all|your instructions)/i,
    /reveal your (prompt|instructions|rules)/i,
    /\boverride (the )?(system|safety)\b/i,
  ]
  if (!isResume && offTopicPatterns.some((re) => re.test(lastUserText))) {
    const safeReply =
      "I'm here to help with your personal finances. I can query your spending, budgets, loans, savings goals, and subscriptions — and even help you make changes. What would you like to explore?"
    const stream = new ReadableStream({
      start(controller) {
        const emit = (data: object) => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
        }
        emit({ event: 'text_delta', text: safeReply })
        emit({ event: 'done', reason: 'end_turn' })
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimit = await checkAndLogAiUsage(supabase, user.id, 'agent')
  if (!rateLimit.allowed) {
    return new Response(await rateLimit.response.text(), {
      status: rateLimit.response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Timezone helpers ────────────────────────────────────────────────────
  const tz =
    typeof clientTimezone === 'string' && clientTimezone.length > 0
      ? clientTimezone
      : 'America/Los_Angeles'

  const toLocalDate = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)

  const now = new Date()
  const todayStr = toLocalDate(now)

  // ── All DB prefetch in one parallel batch ───────────────────────────────
  const [
    profileRow,
    userModelRow,
    userModelAppSetting,
    conversationHistory,
    userPrefs,
    activeMemories,
    gcalIntegrationRes,
    agentPromptSettingRes,
    userAgentPromptRow,
  ] = await Promise.all([
    supabase.from('profiles').select('ai_enabled').eq('id', user.id).maybeSingle(),
    supabase.from('user_prompts').select('content').eq('user_id', user.id).eq('prompt_key', 'ai_model').eq('is_active', true).maybeSingle(),
    supabase.from('app_settings').select('value').eq('key', 'ai_model_agent_default').maybeSingle(),
    fetchRecentConversationHistory(supabase, user.id, sessionId),
    fetchUserPreferences(supabase, user.id),
    fetchActiveMemories(supabase, user.id),
    supabase.from('user_integrations').select('access_token, refresh_token, token_expires_at').eq('user_id', user.id).eq('provider', 'google_calendar').maybeSingle(),
    supabase.from('app_settings').select('value').eq('key', 'ai_agent_system_prompt').maybeSingle(),
    supabase.from('user_prompts').select('content').eq('user_id', user.id).eq('prompt_key', 'ai_agent').eq('is_active', true).maybeSingle(),
  ])

  // ── Access control: AI must be enabled for this account ──────────────────
  if (!profileRow.data?.ai_enabled) {
    return new Response(
      JSON.stringify({ error: 'AI features are not enabled for your account.', code: 'AI_DISABLED' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── Resume state (write confirmation follow-up) ──────────────────────────
  let resumeMessages: Anthropic.MessageParam[] | null = null
  let resumeModel = ''
  if (isResume && resumeActionRow && resumeState) {
    // Replay guard, claimed atomically now that all gates have passed: the
    // NOT NULL predicate means exactly one concurrent resume wins
    const { data: claimed } = await supabase
      .from('agent_action_log')
      .update({ messages_state: null })
      .eq('id', resumeActionRow.id)
      .eq('user_id', user.id)
      .not('messages_state', 'is', null)
      .select('id')

    if (!claimed?.length) {
      return new Response(JSON.stringify({ error: 'Action cannot be resumed' }), { status: 409 })
    }

    const resultJson = resumeActionRow.result_json as { text?: string } | null
    const toolResultText =
      resumeActionRow.status === 'rejected'
        ? 'The user declined this action. Do not retry it — acknowledge briefly and offer alternatives if helpful.'
        : resultJson?.text ?? 'Action executed.'

    const toolResults: Anthropic.ToolResultBlockParam[] = [
      ...resumeState.allOtherToolResults,
      { type: 'tool_result', tool_use_id: resumeState.toolUseId, content: toolResultText },
    ]
    resumeMessages = [...resumeState.messages, { role: 'user', content: toolResults }]
    resumeModel = resumeState.model
  }

  // ── Resolve model ───────────────────────────────────────────────────────
  const userDefaultModel =
    userModelRow.data?.content?.trim() ||
    userModelAppSetting.data?.value ||
    DEFAULT_AI_MODEL
  const VALID_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6']
  const aiModel =
    typeof requestModel === 'string' && VALID_MODELS.includes(requestModel)
      ? requestModel
      : VALID_MODELS.includes(resumeModel)
        ? resumeModel
        : userDefaultModel

  // ── Resolve agent prompt ────────────────────────────────────────────────
  const gcalIntegration = gcalIntegrationRes.data ?? null
  const agentPromptDefault = agentPromptSettingRes.data?.value ?? DEFAULT_PROMPTS.ai_agent.content
  const agentPromptTemplate = userAgentPromptRow.data?.content ?? agentPromptDefault

  // ── Build system prompt ─────────────────────────────────────────────────
  // The safety prefix is applied unconditionally and takes precedence over any
  // user-customized prompt below it. It is never replaceable via user_prompts.
  const calendarCapabilities = gcalIntegration
    ? `\nYou also have Google Calendar tools: get_calendar_events and create_calendar_event. Use them whenever the user asks about their schedule or wants to add events.\n`
    : ''
  const safetyPrefix = buildSafetyPrefix(!!gcalIntegration, calendarCapabilities)

  const memoryContext = buildMemoryContext(conversationHistory, userPrefs, activeMemories)
  const dateContext = `\n\nToday's date: ${todayStr}. User timezone: ${tz}.`

  const gcalTools: Anthropic.Tool[] = []
  if (gcalIntegration) {
    gcalTools.push({
      name: 'get_calendar_events',
      description: `Fetch events from the user's Google Calendar. Use whenever the user asks about their schedule, upcoming events, appointments, or calendar-related info. Refer to today's date from the system prompt context. Default end_date: 7 days after start.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          start_date: { type: 'string', description: 'Start date YYYY-MM-DD.' },
          end_date: { type: 'string', description: 'End date YYYY-MM-DD (inclusive). Default: 7 days after start.' },
        },
        required: ['start_date', 'end_date'],
      },
    })
    gcalTools.push({
      name: 'create_calendar_event',
      description: `Create a new event on the user's Google Calendar. Use when the user asks to add, schedule, or set a reminder on a specific date.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Event title.' },
          date: { type: 'string', description: 'Date YYYY-MM-DD.' },
          start_time: { type: 'string', description: 'Optional HH:MM 24-hour start time. Omit for all-day.' },
          end_time: { type: 'string', description: 'Optional HH:MM 24-hour end time. Defaults to 1 hour after start.' },
          description: { type: 'string', description: 'Optional notes.' },
        },
        required: ['title', 'date'],
      },
    })
  }

  const webSearchTool: Anthropic.WebSearchTool20250305 = {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 3,
  }

  const allTools: Anthropic.ToolUnion[] = [...READ_TOOLS, ...WRITE_TOOLS, ...gcalTools, webSearchTool]

  const isDev = process.env.NODE_ENV === 'development'
  const log = (...args: unknown[]) => { if (isDev) console.log('[ai-agent]', ...args) }

  // ── SSE stream ──────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const emit = (data: object) => {
        if (closed) return
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      log(`▶ start  model=${aiModel}  resume=${isResume}  q="${lastUserText.slice(0, 80)}"`)
      const t0 = Date.now()

      if (!isResume && lastUserText) {
        // Fire-and-forget: save user turn before starting the agent loop
        void saveConversationTurn(supabase, {
          userId: user.id,
          sessionId,
          role: 'user',
          content: lastUserText,
          mode: 'agent',
        })
      }

      // Full-turn token accounting: every loop iteration (query + tool calls +
      // reasoning) accumulates here and is billed against the daily cost cap
      const turnUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }

      // Noop default so the finally block is always safe to call even if
      // createMcpContext never runs (e.g. auth failed earlier in the handler)
      let mcpCleanup: () => Promise<void> = async () => {}

      try {
        const { client: mcpClient, cleanup } = await createMcpContext(user.id, supabase, tz)
        mcpCleanup = cleanup

        let currentMessages: Anthropic.MessageParam[] = resumeMessages ?? [...clientMessages]
        let continueLoop = true
        let iterationCount = 0
        let finalText = ''

        while (continueLoop) {
          iterationCount++
          if (iterationCount > MAX_ITERATIONS + 1) {
            emit({ event: 'error', message: 'Reached maximum reasoning steps.' })
            break
          }
          // On the last permitted iteration, withhold tools so the model must
          // deliver a final answer instead of erroring out mid-plan
          const finalIteration = iterationCount >= MAX_ITERATIONS
          const toolsForIteration = finalIteration
            ? undefined
            : allTools.map((t, i) =>
                i === allTools.length - 1 ? ({ ...t, cache_control: { type: 'ephemeral' as const } } as Anthropic.ToolUnion) : t,
              )

          log(`  iter ${iterationCount}  calling Anthropic…${finalIteration ? ' (final, no tools)' : ''}`)
          const tIter = Date.now()
          const agentSystemBlocks: Anthropic.TextBlockParam[] = [
            { type: 'text', text: safetyPrefix },
            { type: 'text', text: agentPromptTemplate, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: dateContext + memoryContext },
          ]

          // ── Anthropic streaming call with idle-reset timeout ─────────────
          // The timer aborts only when NO chunk has arrived for the window —
          // a long healthy stream is never cut off
          let iterationText = ''
          const abortCtrl = new AbortController()
          let idleTimer: ReturnType<typeof setTimeout> | null = null
          const resetIdle = () => {
            if (idleTimer) clearTimeout(idleTimer)
            idleTimer = setTimeout(() => {
              log(`  iter ${iterationCount}  IDLE TIMEOUT — no data from Anthropic for ${STREAM_IDLE_TIMEOUT_MS / 1000}s`)
              abortCtrl.abort()
            }, STREAM_IDLE_TIMEOUT_MS)
          }
          let response: Anthropic.Message
          try {
            resetIdle()
            const msgStream = anthropic.messages.stream(
              {
                model: aiModel,
                max_tokens: 8192,
                system: sanitizeForJSON(agentSystemBlocks),
                ...(toolsForIteration ? { tools: toolsForIteration } : {}),
                messages: sanitizeForJSON(currentMessages),
              },
              { signal: abortCtrl.signal },
            )
            for await (const chunk of msgStream) {
              resetIdle()
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                iterationText += chunk.delta.text
                emit({ event: 'text_delta', text: chunk.delta.text })
              }
              // Surface server-side web search activity as tool steps
              if (chunk.type === 'content_block_start' && chunk.content_block.type === 'server_tool_use') {
                emit({ event: 'tool_start', toolName: 'web_search', toolUseId: chunk.content_block.id })
              }
              if (chunk.type === 'content_block_start' && chunk.content_block.type === 'web_search_tool_result') {
                emit({ event: 'tool_result', toolName: 'web_search', toolUseId: chunk.content_block.tool_use_id, summary: 'Searched the web' })
              }
            }
            log(`  iter ${iterationCount}  stream drained — awaiting finalMessage()`)
            response = await msgStream.finalMessage()
          } catch (anthropicErr) {
            console.error('[ai-agent] Anthropic error:', anthropicErr)
            emit({ event: 'error', message: anthropicErr instanceof Error ? anthropicErr.message : 'Anthropic call failed' })
            break
          } finally {
            if (idleTimer) clearTimeout(idleTimer)
          }
          log(`  iter ${iterationCount}  stop=${response.stop_reason}  ${Date.now() - tIter}ms  in=${response.usage.input_tokens}tok out=${response.usage.output_tokens}tok`)

          turnUsage.inputTokens += response.usage.input_tokens
          turnUsage.outputTokens += response.usage.output_tokens
          turnUsage.cacheCreationTokens += response.usage.cache_creation_input_tokens ?? 0
          turnUsage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0

          finalText += iterationText

          if (response.stop_reason === 'pause_turn') {
            // Server tool (web search) still running — hand the partial turn back
            currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]
            continue
          }

          if (response.stop_reason === 'tool_use') {
            const toolUseBlocks = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
            )

            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: response.content },
            ]

            const toolResults: Anthropic.ToolResultBlockParam[] = []
            let pendingWrite: { toolUse: Anthropic.ToolUseBlock; resolvedInput: Record<string, unknown>; preview: string } | null = null

            for (const toolUse of toolUseBlocks) {
              // Google Calendar tools
              if (toolUse.name === 'get_calendar_events' || toolUse.name === 'create_calendar_event') {
                emit({ event: 'tool_start', toolName: toolUse.name, toolUseId: toolUse.id })
                // Guard: a resumed conversation can reference calendar tools
                // even if the integration was disconnected in the meantime
                if (!gcalIntegration) {
                  emit({ event: 'tool_result', toolName: toolUse.name, toolUseId: toolUse.id, summary: 'Calendar not connected' })
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: 'Google Calendar is not connected. Ask the user to connect it in Settings → Integrations.',
                  })
                  continue
                }
                let resultContent: string
                try {
                  let accessToken = gcalIntegration!.access_token
                  if (
                    gcalIntegration!.refresh_token &&
                    gcalIntegration!.token_expires_at &&
                    new Date(gcalIntegration!.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)
                  ) {
                    const refreshed = await refreshAccessToken(gcalIntegration!.refresh_token)
                    accessToken = refreshed.access_token
                    await supabase
                      .from('user_integrations')
                      .update({
                        access_token: refreshed.access_token,
                        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
                        updated_at: new Date().toISOString(),
                      })
                      .eq('user_id', user.id)
                      .eq('provider', 'google_calendar')
                  }
                  if (toolUse.name === 'get_calendar_events') {
                    const input = toolUse.input as { start_date: string; end_date: string }
                    const timeMin = new Date(`${input.start_date}T00:00:00`).toISOString()
                    const timeMax = new Date(`${input.end_date}T23:59:59`).toISOString()
                    const events = await getCalendarEvents(accessToken, timeMin, timeMax)
                    resultContent = events.length === 0
                      ? 'No events found for this date range.'
                      : events.map(e => {
                          const start = e.start.date ?? e.start.dateTime?.split('T')[0] ?? 'unknown'
                          const timeStr = e.start.dateTime
                            ? ` at ${new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                            : ' (all day)'
                          const desc = e.description ? ` — ${e.description.slice(0, 120)}` : ''
                          return `• ${e.summary}${timeStr} on ${start}${desc}`
                        }).join('\n')
                  } else {
                    const input = toolUse.input as { title: string; date: string; start_time?: string; end_time?: string; description?: string }
                    let eventBody: Parameters<typeof createCalendarEvent>[1]
                    if (input.start_time) {
                      // Default end = start + 1h, clamped to 23:59 so a 23:xx
                      // start never produces an invalid "24:xx" time
                      const endTime = input.end_time ?? (() => {
                        const [h, m] = input.start_time!.split(':').map(Number)
                        return h + 1 >= 24 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                      })()
                      eventBody = {
                        summary: input.title,
                        description: input.description,
                        start: { dateTime: `${input.date}T${input.start_time}:00`, timeZone: tz },
                        end: { dateTime: `${input.date}T${endTime}:00`, timeZone: tz },
                      }
                    } else {
                      const nextDay = new Date(input.date)
                      nextDay.setDate(nextDay.getDate() + 1)
                      eventBody = {
                        summary: input.title,
                        description: input.description,
                        start: { date: input.date },
                        end: { date: nextDay.toISOString().split('T')[0] },
                      }
                    }
                    const created = await createCalendarEvent(accessToken, eventBody)
                    resultContent = `Event created: "${input.title}" on ${input.date}${input.start_time ? ` at ${input.start_time}` : ' (all day)'}. Link: ${created.htmlLink}`
                  }
                } catch (err) {
                  resultContent = `Calendar error: ${err instanceof Error ? err.message : 'unknown error'}`
                }
                const summary = toolUse.name === 'get_calendar_events' ? 'Fetched calendar events' : 'Created calendar event'
                emit({ event: 'tool_result', toolName: toolUse.name, toolUseId: toolUse.id, summary })
                toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: resultContent })
                continue
              }

              // One pending write at a time — guard before the MCP call
              if (WRITE_TOOL_NAMES.includes(toolUse.name) && pendingWrite) {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: 'Another action is already awaiting user confirmation. Only one action can be pending at a time — propose this again after the current one is resolved.',
                })
                continue
              }

              log(`    tool  ${toolUse.name}  input=${JSON.stringify(toolUse.input).slice(0, 120)}`)
              const tTool = Date.now()
              emit({ event: 'tool_start', toolName: toolUse.name, toolUseId: toolUse.id })

              const mcpResult = await mcpClient.callTool({
                name: toolUse.name,
                arguments: toolUse.input as Record<string, unknown>,
              })

              type McpContentBlock = { type: 'text'; text: string } | { type: string }
              const mcpContent = mcpResult.content as McpContentBlock[]
              let resultText = ''
              for (const block of mcpContent) {
                if (block.type === 'text') { resultText = (block as { type: 'text'; text: string }).text; break }
              }

              const pending = tryParsePending(resultText)

              if (pending !== null) {
                if (AUTO_EXECUTE_TOOL_NAMES.includes(pending.toolName)) {
                  // Non-destructive: execute immediately without user confirmation
                  log(`    tool  ${toolUse.name}  WRITE auto-exec`)
                  const writeResult = await executeWriteTool(pending.toolName, pending.resolvedInput, user.id, supabase, tz)
                  emit({ event: 'tool_result', toolName: toolUse.name, toolUseId: toolUse.id, summary: pending.preview })
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: writeResult.text })
                } else {
                  // Destructive: pause for user confirmation
                  log(`    tool  ${toolUse.name}  WRITE — resolved, awaiting user confirmation`)
                  emit({ event: 'tool_result', toolName: toolUse.name, toolUseId: toolUse.id, summary: 'Awaiting your confirmation' })
                  pendingWrite = { toolUse, resolvedInput: pending.resolvedInput, preview: pending.preview }
                }
              } else {
                const isWriteClarification = WRITE_TOOL_NAMES.includes(toolUse.name)
                log(`    tool  ${toolUse.name}  done  ${Date.now() - tTool}ms${mcpResult.isError ? '  [error]' : ''}`)
                emit({
                  event: 'tool_result',
                  toolName: toolUse.name,
                  toolUseId: toolUse.id,
                  summary: isWriteClarification ? 'Needs clarification' : toolUse.name,
                })
                toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: resultText })
              }
            }

            if (pendingWrite) {
              const { data: actionRow } = await supabase
                .from('agent_action_log')
                .insert({
                  user_id: user.id,
                  tool_name: pendingWrite.toolUse.name,
                  input_json: pendingWrite.resolvedInput,
                  status: 'pending',
                  messages_state: JSON.stringify({
                    messages: trimMessagesForState(currentMessages),
                    toolUseId: pendingWrite.toolUse.id,
                    toolName: pendingWrite.toolUse.name,
                    model: aiModel,
                    allOtherToolResults: toolResults,
                  }),
                })
                .select()
                .single()
              emit({
                event: 'pending_action',
                actionId: actionRow?.id,
                toolName: pendingWrite.toolUse.name,
                preview: pendingWrite.preview,
              })
              emit({ event: 'done', reason: 'awaiting_confirmation' })
              continueLoop = false
            } else {
              currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
            }
          } else {
            log(`◀ done  ${iterationCount} iter  ${Date.now() - t0}ms total  reply=${finalText.length} chars`)
            if (finalText) {
              void saveConversationTurn(supabase, { userId: user.id, sessionId, role: 'assistant', content: finalText, mode: 'agent' })
            }
            if (lastUserText && finalText) {
              void extractAndSaveMemories(anthropic, supabase, user.id, lastUserText, finalText, 'agent')
            }
            emit({ event: 'done', reason: 'end_turn' })
            continueLoop = false
          }
        }
      } catch (err) {
        console.error('[ai-agent] unhandled error:', err)
        emit({ event: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        await mcpCleanup()
        // Persist the turn's cost and surface today's spend for the usage meter
        const turnCost = estimateCostUsd(aiModel, turnUsage)
        emit({
          event: 'usage',
          costUsed: Number((rateLimit.costUsedToday + turnCost).toFixed(4)),
          costCap: rateLimit.costCap,
        })
        void recordAiUsageCost(rateLimit.usageLogId, aiModel, turnUsage)
        if (!closed) controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
