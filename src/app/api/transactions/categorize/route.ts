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
    const { description } = body as { description: string }

    if (!description || typeof description !== 'string' || description.trim().length < 2) {
      return NextResponse.json({ categoryId: null }, { status: 200 })
    }

    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user.id)
      .order('name')

    if (!cats || cats.length === 0) {
      return NextResponse.json({ categoryId: null }, { status: 200 })
    }

    const catList = cats.map((c) => `${c.id} | ${c.name} (${c.type})`).join('\n')

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `Categorize this transaction merchant/description: "${description.trim()}"\n\nAvailable categories:\n${catList}\n\nReply with ONLY the category ID (UUID) that best fits. If none fit well, reply "none". No other text.`,
        },
      ],
    })

    const reply =
      msg.content[0].type === 'text' ? msg.content[0].text.trim() : 'none'
    const suggestedId = reply.split('|')[0].trim()

    if (suggestedId !== 'none' && cats.some((c) => c.id === suggestedId)) {
      return NextResponse.json({ categoryId: suggestedId }, { status: 200 })
    }

    return NextResponse.json({ categoryId: null }, { status: 200 })
  } catch {
    // Fail silently — auto-categorization is best-effort
    return NextResponse.json({ categoryId: null }, { status: 200 })
  }
}
