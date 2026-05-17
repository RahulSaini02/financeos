import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST( req: NextRequest ) {
  if ( !process.env.ANTHROPIC_API_KEY ) {
    return NextResponse.json( { ok: false }, { status: 200 } );
  }

  try {
    const { userId, firstDay } = await req.json() as { userId: string; firstDay: string };
    if ( !userId || !firstDay ) return NextResponse.json( { ok: false }, { status: 400 } );

    const supabase = await createServerSupabaseClient();

    // Idempotency check — skip if already generated this month
    const { data: existing } = await supabase
      .from( 'ai_insights' )
      .select( 'id' )
      .eq( 'user_id', userId )
      .eq( 'type', 'monthly' )
      .eq( 'month', firstDay )
      .limit( 1 );

    if ( existing && existing.length > 0 ) {
      return NextResponse.json( { ok: true, skipped: true } );
    }

    // Fetch previous month's transactions
    const now = new Date();
    const pad = ( n: number ) => String( n ).padStart( 2, '0' );
    const prevMonthDate = new Date( now.getFullYear(), now.getMonth() - 1, 1 );
    const prevMonthFirstDay = `${ prevMonthDate.getFullYear() }-${ pad( prevMonthDate.getMonth() + 1 ) }-01`;
    const prevMonthLastDay = new Date( now.getFullYear(), now.getMonth(), 0 ).toISOString().split( 'T' )[0];

    const { data: prevTransactions } = await supabase
      .from( 'transactions' )
      .select( 'amount_usd, cr_dr, is_internal_transfer' )
      .eq( 'user_id', userId )
      .gte( 'date', prevMonthFirstDay )
      .lte( 'date', prevMonthLastDay );

    if ( !prevTransactions || prevTransactions.length === 0 ) {
      return NextResponse.json( { ok: true, skipped: true } );
    }

    const prevIncome = prevTransactions
      .filter( t => t.cr_dr === 'credit' && !t.is_internal_transfer )
      .reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
    const prevExpenses = prevTransactions
      .filter( t => t.cr_dr === 'debit' && !t.is_internal_transfer )
      .reduce( ( s, t ) => s + Math.abs( t.amount_usd ?? 0 ), 0 );
    const prevSavingsRate = prevIncome > 0
      ? ( ( prevIncome - prevExpenses ) / prevIncome * 100 ).toFixed( 1 )
      : '0';

    const anthropic = new Anthropic( { apiKey: process.env.ANTHROPIC_API_KEY } );
    const summaryMsg = await anthropic.messages.create( {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Generate a concise monthly financial summary for ${ prevMonthDate.toLocaleDateString( 'en-US', { month: 'long', year: 'numeric' } ) }. Data:\n- Income: $${ prevIncome.toFixed( 2 ) }, Expenses: $${ prevExpenses.toFixed( 2 ) }, Savings rate: ${ prevSavingsRate }%\nWrite 3-4 sentences covering performance and one actionable suggestion. No markdown.`,
        },
      ],
    } );

    const summaryText = summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : null;
    if ( summaryText ) {
      await supabase
        .from( 'ai_insights' )
        .insert( { user_id: userId, type: 'monthly', content: summaryText, month: firstDay, is_read: false } );
    }

    return NextResponse.json( { ok: true } );
  } catch {
    return NextResponse.json( { ok: false }, { status: 200 } ); // non-fatal
  }
}
