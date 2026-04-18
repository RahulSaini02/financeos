import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/cron/promote-imports
 * Runs daily. Auto-promotes clean pending_imports (not flagged, has
 * account + amount + date) to confirmed transactions.
 * Flagged / incomplete rows are left for manual review on /import.
 *
 * Authorize with: Authorization: Bearer <CRON_SECRET>
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

  try {
    const supabase = await createServerSupabaseClient()

    // Fetch pending imports that are clean (not flagged, have required fields)
    const { data: imports, error: fetchErr } = await supabase
      .from('pending_imports')
      .select('*')
      .eq('status', 'pending')
      .eq('flagged', false)
      .not('parsed_amount', 'is', null)
      .not('parsed_date', 'is', null)
      .not('suggested_account_id', 'is', null)

    if (fetchErr) {
      return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 })
    }

    const results: { id: string; promoted: boolean; txnId?: string; error?: string }[] = []

    for (const imp of imports ?? []) {
      // Deduplicate: same merchant + amount + date already in transactions
      const { data: dupes } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', imp.user_id)
        .eq('description', imp.parsed_merchant ?? '')
        .eq('amount_usd', -(imp.parsed_amount ?? 0))
        .eq('date', imp.parsed_date ?? '')
        .limit(1)

      if (dupes && dupes.length > 0) {
        // Mark as confirmed (duplicate already exists)
        await supabase
          .from('pending_imports')
          .update({ status: 'confirmed', transaction_id: dupes[0].id, reviewed_at: new Date().toISOString() })
          .eq('id', imp.id)
        results.push({ id: imp.id, promoted: false, txnId: dupes[0].id })
        continue
      }

      // Create transaction
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .insert({
          user_id: imp.user_id,
          account_id: imp.suggested_account_id,
          category_id: imp.suggested_category_id ?? null,
          description: imp.parsed_merchant ?? 'Unknown',
          amount_usd: -(imp.parsed_amount ?? 0),
          final_amount: -(imp.parsed_amount ?? 0),
          amount_original: imp.parsed_amount ?? 0,
          original_currency: 'USD',
          cr_dr: 'debit',
          date: imp.parsed_date ?? new Date().toISOString().split('T')[0],
          notes: imp.ai_notes ?? null,
          source: imp.source,
          import_status: 'confirmed',
          flagged: false,
          is_recurring: false,
          ai_categorized: false,
          is_internal_transfer: false,
        })
        .select('id')
        .single()

      if (txnErr || !txn) {
        results.push({ id: imp.id, promoted: false, error: txnErr?.message })
        continue
      }

      // Mark import as confirmed
      await supabase
        .from('pending_imports')
        .update({ status: 'confirmed', transaction_id: txn.id, reviewed_at: new Date().toISOString() })
        .eq('id', imp.id)

      // Update account balance atomically (debit — amount_usd is negative)
      try {
        await supabase.rpc('increment_account_balance', {
          p_account_id: imp.suggested_account_id,
          p_delta: -(imp.parsed_amount ?? 0),
        })
      } catch (rpcErr) {
        console.error('promote-imports: balance update failed for account', imp.suggested_account_id, rpcErr)
      }

      results.push({ id: imp.id, promoted: true, txnId: txn.id })
    }

    const promoted = results.filter(r => r.promoted).length
    return NextResponse.json({ processed: results.length, promoted, results })
  } catch (err) {
    console.error('Promote imports error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
