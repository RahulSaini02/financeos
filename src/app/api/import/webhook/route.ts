/**
 * POST /api/import/webhook
 *
 * Receives parsed transaction data from n8n and stages it in pending_imports.
 *
 * n8n workflow sends:
 *   Header: x-webhook-secret: <WEBHOOK_SECRET env var>
 *   Body: {
 *     user_id: string,           // Supabase user UUID
 *     merchant: string,          // parsed merchant name
 *     amount: number,            // positive number
 *     date: string,              // YYYY-MM-DD
 *     last_four?: string,        // last 4 digits of card
 *     source?: "n8n" | "apple_pay",
 *     suggested_category_id?: string,
 *     suggested_account_id?: string,
 *     ai_notes?: string,
 *     raw_data?: Record<string, unknown>,
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    // ── Validate secret ──────────────────────────────────────────────────────
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (webhookSecret) {
      const incomingSecret = request.headers.get('x-webhook-secret')
      if (incomingSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const {
      user_id,
      merchant,
      amount,
      date,
      last_four,
      source = 'n8n',
      suggested_category_id,
      suggested_account_id,
      ai_notes,
      raw_data,
    } = body

    // ── Basic validation ─────────────────────────────────────────────────────
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }
    if (!merchant || typeof merchant !== 'string') {
      return NextResponse.json({ error: 'merchant is required' }, { status: 400 })
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (!['n8n', 'apple_pay', 'import', 'manual'].includes(source)) {
      return NextResponse.json({ error: 'invalid source' }, { status: 400 })
    }

    // ── Duplicate check: same merchant + amount + date within 24h ────────────
    const supabase = await createServerSupabaseClient()

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('pending_imports')
      .select('id')
      .eq('user_id', user_id)
      .eq('parsed_merchant', merchant.trim())
      .eq('parsed_amount', amount)
      .eq('parsed_date', date)
      .gte('created_at', oneDayAgo)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { message: 'Duplicate skipped', duplicate_of: existing[0].id },
        { status: 200 }
      )
    }

    // ── Insert into pending_imports ──────────────────────────────────────────
    const { data, error } = await supabase
      .from('pending_imports')
      .insert({
        user_id,
        raw_data: raw_data ?? { merchant, amount, date, last_four },
        parsed_merchant: merchant.trim(),
        parsed_amount: amount,
        parsed_date: date,
        parsed_last_four: last_four ?? null,
        source,
        status: 'pending',
        suggested_category_id: suggested_category_id ?? null,
        suggested_account_id: suggested_account_id ?? null,
        ai_notes: ai_notes ?? null,
        flagged: false,
        flagged_reason: null,
      })
      .select()
      .single()

    if (error) {
      console.error('Webhook insert error:', error)
      return NextResponse.json({ error: 'Failed to stage import' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
