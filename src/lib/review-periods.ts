// Shared helpers for AI Review 15-day period logic.
// A period key is always YYYY-MM-01 (first half) or YYYY-MM-16 (second half).

const pad = (n: number) => String(n).padStart(2, '0')

/** Returns the key of the most recently COMPLETED 15-day period as of `now`. */
export function getDefaultPeriodKey(now: Date): string {
  const day = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based

  if (day >= 16) {
    // Days 1-15 of the current month just completed
    return `${year}-${pad(month)}-01`
  } else {
    // Second half of the previous month just completed
    const pm = month === 1 ? 12 : month - 1
    const py = month === 1 ? year - 1 : year
    return `${py}-${pad(pm)}-16`
  }
}

/** Derive start/end Dates and a display label from a period key. */
export function periodInfo(key: string): {
  periodStart: Date
  periodEnd: Date
  label: string
} {
  const [yearStr, monthStr, dayStr] = key.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) // 1-based
  const day = parseInt(dayStr, 10)
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })

  if (day === 1) {
    return {
      periodStart: new Date(year, month - 1, 1),
      periodEnd: new Date(year, month - 1, 15),
      label: `${monthName} 1–15, ${year}`,
    }
  } else {
    const lastDay = new Date(year, month, 0).getDate()
    return {
      periodStart: new Date(year, month - 1, 16),
      periodEnd: new Date(year, month - 1, lastDay),
      label: `${monthName} 16–${lastDay}, ${year}`,
    }
  }
}

/** Returns the period key immediately before the given one. */
export function prevPeriodKey(key: string): string {
  const [yearStr, monthStr, dayStr] = key.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  if (day === 16) {
    // Prior period is the first half of the same month
    return `${year}-${pad(month)}-01`
  } else {
    // Prior period is the second half of the previous month
    const pm = month === 1 ? 12 : month - 1
    const py = month === 1 ? year - 1 : year
    return `${py}-${pad(pm)}-16`
  }
}

/** Derives the prior period's start/end dates for comparison data. */
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
