import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DashboardInsightCard } from "@/components/dashboard/DashboardInsightCard";

interface Props {
  userId: string;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  flaggedCount: number;
  billsCount: number;
}

export async function DashboardInsightLoader( {
  userId, netWorth, monthlyIncome, monthlyExpenses, flaggedCount, billsCount,
}: Props ) {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const todayStr = now.toISOString().split( 'T' )[0];
  const pad = ( n: number ) => String( n ).padStart( 2, '0' );
  const firstDay = `${ now.getFullYear() }-${ pad( now.getMonth() + 1 ) }-01`;

  // Fetch existing insight for today
  const { data: existing } = await supabase
    .from( 'ai_insights' )
    .select( '*' )
    .eq( 'user_id', userId )
    .eq( 'type', 'daily' )
    .gte( 'created_at', todayStr )
    .order( 'created_at', { ascending: false } )
    .limit( 1 )
    .single();

  if ( existing ) {
    if ( existing.is_read ) return null;
    return (
      <DashboardInsightCard
        insightId={existing.id}
        content={existing.content}
        isRead={existing.is_read}
      />
    );
  }

  // No insight yet today — generate one
  if ( !process.env.ANTHROPIC_API_KEY ) return null;

  const newInsight = await generateDailyInsight( {
    supabase, userId, firstDay, netWorth, monthlyIncome, monthlyExpenses, flaggedCount, billsCount,
  } );

  if ( !newInsight ) return null;
  return (
    <DashboardInsightCard
      insightId={newInsight.id}
      content={newInsight.content}
      isRead={false}
    />
  );
}

async function generateDailyInsight( {
  supabase, userId, firstDay, netWorth, monthlyIncome, monthlyExpenses, flaggedCount, billsCount,
}: {
  supabase: Awaited<ReturnType<typeof import( '@/lib/supabase-server' ).createServerSupabaseClient>>;
  userId: string;
  firstDay: string;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  flaggedCount: number;
  billsCount: number;
} ) {
  try {
    const anthropic = new Anthropic( { apiKey: process.env.ANTHROPIC_API_KEY } );
    const savingsRate = monthlyIncome > 0
      ? ( ( monthlyIncome - monthlyExpenses ) / monthlyIncome * 100 ).toFixed( 1 )
      : '0';

    const msg = await anthropic.messages.create( {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are a personal finance assistant. Generate a single concise daily financial insight (2-3 sentences max) based on this data:\n- Net worth: $${ netWorth.toFixed( 2 ) }\n- This month income: $${ monthlyIncome.toFixed( 2 ) }, expenses: $${ monthlyExpenses.toFixed( 2 ) }, savings rate: ${ savingsRate }%\n- Flagged transactions: ${ flaggedCount }\n- Upcoming bills in 7 days: ${ billsCount }\nBe specific, actionable, and encouraging. Do not use markdown. Do not start with "Based on" or "Your data shows".`,
        },
      ],
    } );

    const insightText = msg.content[0].type === 'text' ? msg.content[0].text : null;
    if ( !insightText ) return null;

    const { data: newInsight } = await supabase
      .from( 'ai_insights' )
      .insert( { user_id: userId, type: 'daily', content: insightText, month: firstDay, is_read: false } )
      .select()
      .single();

    // Fire-and-forget monthly insight generation
    if ( process.env.NEXT_PUBLIC_SUPABASE_URL ) {
      const origin = process.env.VERCEL_URL
        ? `https://${ process.env.VERCEL_URL }`
        : 'http://localhost:3000';
      fetch( `${ origin }/api/dashboard/generate-monthly-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { userId, firstDay } ),
        cache: 'no-store',
      } ).catch( () => { /* non-fatal */ } );
    }

    return newInsight ?? null;
  } catch {
    return null;
  }
}
