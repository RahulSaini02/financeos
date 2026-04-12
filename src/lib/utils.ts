import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number, currency: 'USD' | 'INR' = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'iso' = 'short'): string {
  // Append T00:00:00 so date-only strings are parsed as local time, not UTC midnight
  // (avoids off-by-one-day display in timezones west of UTC)
  const d = typeof date === 'string' ? new Date(date.length === 10 ? date + 'T00:00:00' : date) : date
  if (format === 'iso') return d.toISOString().split('T')[0]
  if (format === 'long') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getMonthRange(month: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  return { start, end }
}

export function generateId(): string {
  return crypto.randomUUID()
}
