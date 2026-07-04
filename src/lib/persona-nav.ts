// Persona → default nav visibility + label overrides.
// This only seeds the SAME localStorage prefs the Settings show/hide panel edits
// (NAV_PREFS_KEY) — nothing is ever locked, and hidden tabs keep their data.
// Labels are display-only swaps; no data model changes.

import type { Persona, TrackingScope } from '@/lib/types'

export const PERSONA_OPTIONS: { value: Persona; label: string; description: string }[] = [
  { value: 'student', label: 'Student', description: 'Tracking spending on a budget' },
  { value: 'freelancer', label: 'Freelancer', description: 'Variable income, quarterly taxes' },
  { value: 'employed', label: 'Employed', description: 'Salaried with regular paychecks' },
  { value: 'business_owner', label: 'Business Owner', description: 'Running a business' },
  { value: 'trader', label: 'Trader / Investor', description: 'Markets and portfolios first' },
  { value: 'between_jobs', label: 'Between Jobs', description: 'Watching every dollar for now' },
  { value: 'other', label: 'Other', description: 'Just show me everything' },
]

export const TRACKING_OPTIONS: { value: TrackingScope; label: string; description: string }[] = [
  { value: 'spending', label: 'Spending only', description: 'Transactions, budgets, and bills' },
  { value: 'spending_savings', label: 'Spending + savings', description: 'Add savings goals on top' },
  { value: 'full', label: 'The full picture', description: 'Accounts, investments, loans — everything' },
]

// Hrefs must match ALL_NAV_ITEMS in src/components/ui/app-shell.tsx.
// /dashboard and /ai-review stay visible for every persona; /admin is role-gated elsewhere.
const BASE_VISIBLE: Record<Persona, string[]> = {
  student: ['/dashboard', '/transactions', '/budgets', '/savings-goals', '/categories', '/ai-review'],
  employed: [
    '/dashboard', '/transactions', '/budgets', '/savings-goals', '/categories', '/ai-review',
    '/accounts', '/paychecks', '/subscriptions',
  ],
  freelancer: [
    '/dashboard', '/transactions', '/accounts', '/budgets', '/categories', '/ai-review',
    '/paychecks', '/tax-estimator',
  ],
  business_owner: [
    '/dashboard', '/transactions', '/accounts', '/budgets', '/categories', '/ai-review',
    '/employers', '/tax-estimator', '/import',
  ],
  trader: ['/dashboard', '/investments', '/accounts', '/transactions', '/ai-review'],
  between_jobs: [
    '/dashboard', '/transactions', '/budgets', '/categories', '/ai-review',
    '/subscriptions', '/savings-goals',
  ],
  other: [], // empty = show everything
}

const FULL_PICTURE_EXTRAS = ['/accounts', '/savings-goals', '/investments', '/loans']

/** Hrefs that should be visible by default for a persona + tracking scope. */
export function defaultVisibleHrefs(persona: Persona, scope: TrackingScope): Set<string> | null {
  const base = BASE_VISIBLE[persona]
  if (base.length === 0) return null // 'other' → show everything

  const visible = new Set(base)
  if (scope === 'spending') {
    // Spending-only trims wealth-tracking tabs — unless they're core to the persona
    if (persona !== 'trader') visible.delete('/investments')
    visible.delete('/savings-goals')
    visible.delete('/loans')
  } else if (scope === 'spending_savings') {
    visible.add('/savings-goals')
  } else {
    for (const href of FULL_PICTURE_EXTRAS) visible.add(href)
  }
  return visible
}

// Display-only tab relabels per persona (e.g. gig workers don't get "paychecks").
const PERSONA_LABELS: Partial<Record<Persona, Record<string, string>>> = {
  freelancer: { '/paychecks': 'Income' },
  trader: { '/paychecks': 'Income' },
}

export const PERSONA_PREF_KEY = 'pref_persona'

export function getStoredPersona(): Persona | null {
  if (typeof window === 'undefined') return null
  const p = localStorage.getItem(PERSONA_PREF_KEY)
  return PERSONA_OPTIONS.some((o) => o.value === p) ? (p as Persona) : null
}

/** Label override for a nav href given the stored persona; null = keep default label. */
export function personaNavLabel(href: string, persona: Persona | null = getStoredPersona()): string | null {
  if (!persona) return null
  return PERSONA_LABELS[persona]?.[href] ?? null
}
