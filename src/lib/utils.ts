import { clsx, type ClassValue } from 'clsx'
import type { CurrencyCode } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(
  amount: number,
  currency: 'USD' | 'INR' = 'USD',
  fractionDigits = 2,
): string {
  // INR uses Indian digit grouping (e.g. ₹10,00,000.00); everything else uses en-US
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}

export const DEFAULT_TIMEZONE = 'America/Los_Angeles'

export function getUserTimezone(): string {
  if (typeof window === 'undefined') return DEFAULT_TIMEZONE
  return localStorage.getItem('pref_timezone') ?? DEFAULT_TIMEZONE
}

// Region drives display labels + date ordering only, never data structure.
// Source of truth is profiles.region; mirrored to localStorage on load/save
// (same pattern as pref_timezone) so pure client utils can read it.
export type UserRegion = 'US' | 'IN' | 'other'

export function getUserRegion(): UserRegion {
  if (typeof window === 'undefined') return 'US'
  const r = localStorage.getItem('pref_region')
  return r === 'IN' || r === 'other' ? r : 'US'
}

// India reads DD/MM — en-GB gives "14 Apr 2026" / "14 April 2026" ordering.
function dateLocale(): string {
  return getUserRegion() === 'IN' ? 'en-GB' : 'en-US'
}

// Parse a YYYY-MM-DD string as local midnight so timezone offset never shifts the day.
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'iso' = 'short', timeZone?: string): string {
  // Date-only strings (YYYY-MM-DD) represent calendar dates, not timestamps.
  // Parse as explicit year/month/day to avoid any timezone offset shifting the day.
  const locale = dateLocale()
  if (typeof date === 'string' && date.length === 10) {
    const [y, m, d] = date.split('-').map(Number)
    const local = new Date(y, m - 1, d) // midnight in local machine time — no TZ conversion needed
    if (format === 'iso') return date
    if (format === 'long') return local.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    return local.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const d = typeof date === 'string' ? new Date(date) : date
  if (format === 'iso') return d.toISOString().split('T')[0]
  const tz = timeZone ?? getUserTimezone()
  if (format === 'long') return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: tz })
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz })
}

export function getMonthRange(month: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  return { start, end }
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function getBaseCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  return (localStorage.getItem("pref_default_currency") as CurrencyCode) || "USD";
}
