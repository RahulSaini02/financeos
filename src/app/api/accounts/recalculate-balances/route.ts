import { NextResponse } from 'next/server'

// Deprecated: recalculate-balances is no longer supported.
// Account balances are managed directly — summing transactions is unreliable
// because loan payments and other adjustments are tracked outside of transactions.
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been removed. Update account balances via the Edit Account form.' },
    { status: 410 }
  )
}
