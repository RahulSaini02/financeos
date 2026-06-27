import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type RawTxn = {
  id: string
  description: string
  final_amount: number
  cr_dr: 'credit' | 'debit'
  date: string
  account: { name: string } | { name: string }[] | null
  category: { name: string } | { name: string }[] | null
}

type RawAccount = {
  id: string
  name: string
  type: string
  current_balance: number
}

type RawCategory = {
  id: string
  name: string
  icon: string | null
}

function pickJoinedName(
  join: { name: string } | { name: string }[] | null,
): string {
  if (!join) return ''
  if (Array.isArray(join)) return join[0]?.name ?? ''
  return join.name
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

    if (q.length < 2) {
      return NextResponse.json({ transactions: [], accounts: [], categories: [] })
    }

    const pattern = `%${q}%`

    const [txnResult, accountResult, categoryResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, description, final_amount, cr_dr, date, account:accounts(name), category:categories(name)')
        .eq('user_id', user.id)
        .ilike('description', pattern)
        .order('date', { ascending: false })
        .limit(5),
      supabase
        .from('accounts')
        .select('id, name, type, current_balance')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .ilike('name', pattern)
        .limit(3),
      supabase
        .from('categories')
        .select('id, name, icon')
        .eq('user_id', user.id)
        .ilike('name', pattern)
        .limit(4),
    ])

    const transactions = ((txnResult.data ?? []) as unknown as RawTxn[]).map((t) => ({
      id: t.id,
      description: t.description,
      final_amount: t.final_amount,
      cr_dr: t.cr_dr,
      date: t.date,
      account_name: pickJoinedName(t.account),
      category_name: pickJoinedName(t.category),
    }))

    const accounts = (accountResult.data ?? []) as RawAccount[]

    const categories = ((categoryResult.data ?? []) as RawCategory[]).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? '',
    }))

    return NextResponse.json({ transactions, accounts, categories })
  } catch (err) {
    console.error('[search] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
