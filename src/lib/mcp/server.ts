// In-process MCP server wired to the FinanceOS agent tool executors.
// Write tools do NOT execute here — they resolve entities and return a
// PendingActionMarker sentinel, which the route picks up and routes
// through the existing user-confirmation flow.
// Swap InMemoryTransport for SSE/StreamableHttp to expose externally later.

import { Server } from '@modelcontextprotocol/sdk/server'
import { Client } from '@modelcontextprotocol/sdk/client'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import { READ_TOOLS, WRITE_TOOLS, WRITE_TOOL_NAMES } from '@/lib/agent/tool-defs'
import { executeReadTool } from '@/lib/agent/read-tools'
import { resolveWriteAction } from '@/lib/agent/resolution'

// ── PendingActionMarker ──────────────────────────────────────────────────────
// Returned by write-tool handlers when entity resolution succeeds.
// The agent route detects this sentinel and starts the confirmation flow.

export interface PendingActionMarker {
  __pending: true
  toolName: string
  resolvedInput: Record<string, unknown>
  preview: string
}

export function tryParsePending(text: string): PendingActionMarker | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>).__pending === true &&
      typeof (parsed as Record<string, unknown>).toolName === 'string'
    ) {
      return parsed as PendingActionMarker
    }
  } catch {
    // not JSON — normal read-tool result
  }
  return null
}

// ── Anthropic.Tool → MCP tool descriptor ────────────────────────────────────
// Only the property key differs: input_schema (Claude) vs inputSchema (MCP).
// The JSON Schema object itself is identical in both formats.

function toMcpToolDef(tool: Anthropic.Tool) {
  return {
    name: tool.name,
    description: tool.description ?? undefined,
    inputSchema: tool.input_schema as {
      type: 'object'
      properties?: Record<string, unknown>
      required?: string[]
    },
  }
}

// ── McpContext ───────────────────────────────────────────────────────────────

export interface McpContext {
  client: Client
  cleanup: () => Promise<void>
}

/**
 * Creates a request-scoped MCP server + client pair connected via
 * InMemoryTransport. Call once per POST request; reuse the client across
 * all agentic loop iterations; call cleanup() in the finally block.
 */
export async function createMcpContext(
  userId: string,
  supabase: SupabaseClient,
  tz: string,
): Promise<McpContext> {
  const allMcpTools = [...READ_TOOLS, ...WRITE_TOOLS].map(toMcpToolDef)

  const server = new Server(
    { name: 'financeos-agent', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  // Advertise every registered tool
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allMcpTools }))

  // Dispatch tool calls to the appropriate executor
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    const input = (args ?? {}) as Record<string, unknown>

    try {
      if (WRITE_TOOL_NAMES.includes(name)) {
        // Write path: resolve entities, return a PendingActionMarker.
        // resolveWriteAction has its own try/catch and never throws.
        const resolution = await resolveWriteAction(name, input, userId, supabase, tz)
        if (!resolution.ok) {
          // Ambiguity or validation failure — plain text so the model can relay
          return { content: [{ type: 'text' as const, text: resolution.message }] }
        }
        const marker: PendingActionMarker = {
          __pending: true,
          toolName: name,
          resolvedInput: resolution.resolvedInput,
          preview: resolution.preview,
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(marker) }] }
      }

      // Read path: executeReadTool has its own try/catch and never throws.
      const result = await executeReadTool(name, input, userId, supabase, tz)
      return { content: [{ type: 'text' as const, text: result.text }] }
    } catch (err) {
      // Belt-and-suspenders: catches anything the above missed (e.g. import errors)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return {
        content: [{ type: 'text' as const, text: `Error executing ${name}: ${msg}` }],
        isError: true,
      }
    }
  })

  // Server must connect first — it owns the transport after connect()
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client(
    { name: 'financeos-route', version: '1.0.0' },
    { capabilities: {} },
  )
  await client.connect(clientTransport)

  return {
    client,
    cleanup: async () => {
      await Promise.allSettled([client.close(), server.close()])
    },
  }
}
