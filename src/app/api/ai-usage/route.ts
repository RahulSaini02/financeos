import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getDailyAiUsage } from '@/lib/ai-rate-limit'

// Powers the user-facing usage meter: "$0.32 / $0.75 used today"
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { costUsedToday, costCap } = await getDailyAiUsage(supabase, user.id)
  return NextResponse.json({
    costUsedToday: Number(costUsedToday.toFixed(4)),
    costCap,
  })
}
