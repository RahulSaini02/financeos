// Shared helpers for AI Review monthly period logic.
// A period key is always YYYY-MM-01 (first day of the month).

const pad = (n: number) => String(n).padStart(2, '0')

/** Returns the key of the most recently COMPLETED month as of `now`. */
export function getDefaultPeriodKey(now: Date): string {
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based current month
  // Always show the previous completed month
  const pm = month === 1 ? 12 : month - 1
  const py = month === 1 ? year - 1 : year
  return `${py}-${pad(pm)}-01`
}

/** Derive start/end Dates and a display label from a period key. */
export function periodInfo(key: string): {
  periodStart: Date
  periodEnd: Date
  label: string
} {
  const [yearStr, monthStr] = key.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) // 1-based
  const lastDay = new Date(year, month, 0).getDate()
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })

  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month - 1, lastDay),
    label: `${monthName} ${year}`,
  }
}

/** Returns the period key for the month immediately before the given one. */
export function prevPeriodKey(key: string): string {
  const [yearStr, monthStr] = key.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const pm = month === 1 ? 12 : month - 1
  const py = month === 1 ? year - 1 : year
  return `${py}-${pad(pm)}-01`
}

/** Derives the prior month's start/end dates for comparison data. */
export function priorPeriodInfo(key: string): { periodStart: Date; periodEnd: Date } {
  const priorKey = prevPeriodKey(key)
  const { periodStart, periodEnd } = periodInfo(priorKey)
  return { periodStart, periodEnd }
}

/** Generates an ordered list of past period keys (most recent first), starting from `fromKey`. */
export function getPastPeriodKeys(fromKey: string, count = 11): string[] {
  const keys: string[] = []
  let current = fromKey
  for (let i = 0; i < count; i++) {
    current = prevPeriodKey(current)
    keys.push(current)
  }
  return keys
}
