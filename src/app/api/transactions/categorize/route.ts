import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEFAULT_PROMPTS } from '@/lib/default-prompts'
import { getUserPrompt } from '@/lib/get-user-prompt'
import { getUserModel } from '@/lib/get-user-model'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ categoryId: null }, { status: 200 })
    }

    const [aiModel, body] = await Promise.all([
      getUserModel(supabase, user.id),
      request.json(),
    ])
    const { description, createIfMissing = false } = body as {
      description: string
      createIfMissing?: boolean
    }

    if (!description || typeof description !== 'string' || description.trim().length < 2) {
      return NextResponse.json({ categoryId: null }, { status: 200 })
    }

    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user.id)
      .order('name')

    // Fetch user's custom categorize prompt template (or fall back to default)
    const categorizeTemplate = await getUserPrompt(
      supabase,
      user.id,
      'auto_categorize',
      DEFAULT_PROMPTS.auto_categorize.content,
    )

    let prompt: string
    if (cats && cats.length > 0) {
      const catList = cats.map((c) => `${c.id} | ${c.name} (${c.type})`).join('\n')
      prompt = categorizeTemplate
        .replaceAll('{{description}}', description.trim())
        .replaceAll('{{category_list}}', catList)
    } else {
      // No categories — fall back to a simple suggestion prompt
      prompt = `Suggest a category for this transaction: "${description.trim()}"

Reply with ONLY: "new:<CategoryName>|<type>" where type is "expense", "income", or "transfer".
No other text.`
    }

    const msg = await anthropic.messages.create({
      model: aiModel,
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    })

    const reply = msg.content[0].type === 'text' ? msg.content[0].text.trim() : 'none'

    // AI suggested a new category
    if (reply.startsWith('new:') && createIfMissing) {
      const rest = reply.slice(4)
      const [rawName, rawType] = rest.split('|').map((s) => s.trim())
      const name = rawName?.trim()
      const validTypes = ['expense', 'income', 'transfer'] as const
      type CategoryType = typeof validTypes[number]
      const type: CategoryType = validTypes.includes(rawType?.toLowerCase() as CategoryType)
        ? (rawType.toLowerCase() as CategoryType)
        : 'expense'

      if (!name) return NextResponse.json({ categoryId: null }, { status: 200 })

      // Deduplicate: return existing category if one with the same name already exists (case-insensitive)
      const escapedName = name.replace(/[%_\\]/g, '\\$&')
      const { data: existing } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id)
        .ilike('name', escapedName)
        .single()

      if (existing) {
        return NextResponse.json({ categoryId: existing.id }, { status: 200 })
      }

      const { data: newCat, error: createErr } = await supabase
        .from('categories')
        .insert({ user_id: user.id, name, type })
        .select()
        .single()

      if (createErr || !newCat) {
        return NextResponse.json({ categoryId: null }, { status: 200 })
      }

      return NextResponse.json({ categoryId: newCat.id, newCategory: newCat }, { status: 200 })
    }

    // AI returned an existing category ID
    const suggestedId = reply.split('|')[0].trim()
    if (suggestedId !== 'none' && cats?.some((c) => c.id === suggestedId)) {
      return NextResponse.json({ categoryId: suggestedId }, { status: 200 })
    }

    return NextResponse.json({ categoryId: null }, { status: 200 })
  } catch {
    // Fail silently — auto-categorization is best-effort
    return NextResponse.json({ categoryId: null }, { status: 200 })
  }
}
