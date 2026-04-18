import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(
  amount: number,
  currency: 'USD' | 'INR' = 'USD',
  fractionDigits = 2,
): string {
  return new Intl.NumberFormat('en-US', {
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

export function formatDate(date: string | Date, format: 'short' | 'long' | 'iso' = 'short', timeZone?: string): string {
  // Date-only strings (YYYY-MM-DD) represent calendar dates, not timestamps.
  // Parse as explicit year/month/day to avoid any timezone offset shifting the day.
  if (typeof date === 'string' && date.length === 10) {
    const [y, m, d] = date.split('-').map(Number)
    const local = new Date(y, m - 1, d) // midnight in local machine time — no TZ conversion needed
    if (format === 'iso') return date
    if (format === 'long') return local.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    return local.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const d = typeof date === 'string' ? new Date(date) : date
  if (format === 'iso') return d.toISOString().split('T')[0]
  const tz = timeZone ?? getUserTimezone()
  if (format === 'long') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: tz })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz })
}

export function getMonthRange(month: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  return { start, end }
}

export function generateId(): string {
  return crypto.randomUUID()
}
