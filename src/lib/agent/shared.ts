// src/lib/agent/shared.ts
// Shared helpers, types, and constants used across the agent tool modules.

import { formatCurrency } from '@/lib/utils'

export const DEFAULT_TZ = 'America/Los_Angeles'

// Escape %, _ and \ so user-supplied strings can't act as ilike wildcards
export function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function like(s: string): string {
  return `%${escapeIlike(s)}%`
}

// Today's date (YYYY-MM-DD) in the user's timezone
export function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// First day of the current month (YYYY-MM-01) in the user's timezone
export function monthStartInTz(tz: string): string {
  return `${todayInTz(tz).slice(0, 7)}-01`
}

export function fmt(n: number): string {
  return formatCurrency(n)
}

// Standard amortization: n = -ln(1 - r·B/EMI) / ln(1+r). Returns null when the
// EMI doesn't cover monthly interest (balance would never decrease).
export function amortizedPayoff(
  balance: number,
  annualRatePct: number,
  emi: number,
): { months: number; totalInterest: number } | null {
  if (balance <= 0) return { months: 0, totalInterest: 0 }
  if (emi <= 0) return null
  const r = annualRatePct / 100 / 12
  if (r <= 0) {
    const months = Math.ceil(balance / emi)
    return { months, totalInterest: 0 }
  }
  if (emi <= balance * r) return null
  const months = Math.ceil(-Math.log(1 - (r * balance) / emi) / Math.log(1 + r))
  const totalInterest = Math.max(emi * months - balance, 0)
  return { months, totalInterest }
}

export interface ToolResult {
  text: string
  summary: string
}
