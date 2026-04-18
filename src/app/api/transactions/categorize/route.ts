import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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

    const body = await request.json()
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

    let prompt: string
    if (cats && cats.length > 0) {
      const catList = cats.map((c) => `${c.id} | ${c.name} (${c.type})`).join('\n')
      prompt = `Categorize this transaction merchant/description: "${description.trim()}"

Available categories:
${catList}

Reply with ONLY one of:
- The category ID (UUID) that best fits
- "new:<CategoryName>|<type>" if none fit well, where type is "expense", "income", or "transfer"

No other text.`
    } else {
      prompt = `Suggest a category for this transaction: "${description.trim()}"

Reply with ONLY: "new:<CategoryName>|<type>" where type is "expense", "income", or "transfer".
No other text.`
    }

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
