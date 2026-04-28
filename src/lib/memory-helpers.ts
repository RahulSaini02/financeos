// src/lib/memory-helpers.ts
// Central helpers for the agentic memory system.
// Handles conversation history, user preferences, user memory facts,
// and memory context building / extraction.

import Anthropic from '@anthropic-ai/sdk'
import { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConversationMessage,
  ConversationMode,
  UserFinancialPreferences,
  UserMemory,
  MemoryCategory,
} from '@/lib/types'

// ── Conversation History ────────────────────────────────────────────────────

export async function fetchRecentConversationHistory(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConversationMessage[]> {
  const { data } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!data) return []
  // Reverse to chronological order
  return (data as ConversationMessage[]).reverse()
}

export async function saveConversationTurn(
  supabase: SupabaseClient,
  params: {
    userId: string
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    mode: ConversationMode
  },
): Promise<void> {
  try {
    await supabase.from('conversation_messages').insert({
      user_id: params.userId,
      session_id: params.sessionId,
      role: params.role,
      content: params.content,
      mode: params.mode,
    })
  } catch (err) {
    console.error('saveConversationTurn error:', err)
  }
}

// ── User Preferences ────────────────────────────────────────────────────────

export async function fetchUserPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserFinancialPreferences | null> {
  const { data } = await supabase
    .from('user_financial_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return (data as UserFinancialPreferences | null) ?? null
}

// ── Active Memories ─────────────────────────────────────────────────────────

export async function fetchActiveMemories(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserMemory[]> {
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('extracted_at', { ascending: false })
    .limit(30)

  return (data as UserMemory[] | null) ?? []
}

// ── Memory Context Builder ──────────────────────────────────────────────────

export function buildMemoryContext(
  history: ConversationMessage[],
  prefs: UserFinancialPreferences | null,
  memories: UserMemory[],
): string {
  const sections: string[] = []

  // User Preferences section
  if (prefs) {
    const prefLines: string[] = []
    prefLines.push(`- Communication style: ${prefs.communication_style}`)
    if (prefs.risk_tolerance) {
      prefLines.push(`- Risk tolerance: ${prefs.risk_tolerance}`)
    }
    if (prefs.financial_goals && prefs.financial_goals.length > 0) {
      prefLines.push(`- Financial goals: ${prefs.financial_goals.join(', ')}`)
    }
    if (prefs.spending_priorities && prefs.spending_priorities.length > 0) {
      prefLines.push(`- Spending priorities: ${prefs.spending_priorities.join(', ')}`)
    }
    if (prefs.custom_instructions) {
      prefLines.push(`- Custom instructions: ${prefs.custom_instructions}`)
    }
    if (prefLines.length > 0) {
      sections.push(`### User Preferences\n${prefLines.join('\n')}`)
    }
  }

  // Remembered Facts section
  if (memories.length > 0) {
    const factLines = memories.map((m) => `- ${m.fact} (${m.category})`)
    sections.push(`### Remembered Facts\n${factLines.join('\n')}`)
  }

  // Recent Conversation History section
  if (history.length > 0) {
    const historyLines = history.map((m) => {
      const speaker = m.role === 'user' ? 'User' : 'Assistant'
      // Truncate very long messages for context efficiency
      const text = m.content.length > 500 ? m.content.slice(0, 500) + '…' : m.content
      return `${speaker}: ${text}`
    })
    sections.push(`### Recent Conversation History\n${historyLines.join('\n')}`)
  }

  if (sections.length === 0) return ''

  return `\n\n## Your Memory Context\n\n${sections.join('\n\n')}`
}

// ── Memory Extraction ───────────────────────────────────────────────────────

interface ExtractedFact {
  fact: string
  category: string
}

export async function extractAndSaveMemories(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  userId: string,
  userMessage: string,
  assistantResponse: string,
  mode: ConversationMode,
): Promise<void> {
  try {
    const extractionPrompt = `You are a financial memory extractor for a personal finance app.
Given one exchange (user message + assistant response), extract 0–3 specific, durable financial facts about the user worth remembering in future sessions.

Rules:
- Facts must be concrete and personal (amounts, dates, goals, decisions)
- No generic financial advice
- Skip facts already obvious from account data (balances, transactions)
- Maximum 3 facts per exchange
- Output ONLY a valid JSON array: [{"fact": "...", "category": "..."}]
- Valid categories: goal | debt | savings | income | spending | investment | preference | general
- If nothing is worth remembering, output []

User message: ${userMessage}
Assistant response: ${assistantResponse}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: extractionPrompt }],
    })

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    )
    if (!textBlock) return

    let extracted: ExtractedFact[]
    try {
      // Strip markdown code fences if present
      const raw = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      extracted = parsed as ExtractedFact[]
    } catch {
      // Invalid JSON — skip silently
      return
    }

    if (extracted.length === 0) return

    // Fetch existing active memories to deduplicate
    const existing = await fetchActiveMemories(supabase, userId)
    const existingSnippets = existing.map((m) => m.fact.slice(0, 80).toLowerCase())

    const validCategories: MemoryCategory[] = [
      'goal', 'debt', 'savings', 'income', 'spending', 'investment', 'preference', 'general',
    ]

    const newFacts = extracted.filter((f) => {
      if (!f.fact || typeof f.fact !== 'string') return false
      const snippet = f.fact.slice(0, 80).toLowerCase()
      return !existingSnippets.includes(snippet)
    })

    for (const f of newFacts) {
      const category: MemoryCategory = validCategories.includes(f.category as MemoryCategory)
        ? (f.category as MemoryCategory)
        : 'general'

      await supabase.from('user_memory').insert({
        user_id: userId,
        fact: f.fact,
        category,
        source_mode: mode,
        is_active: true,
      })
    }
  } catch (err) {
    console.error('extractAndSaveMemories error:', err)
  }
}
