// Region-aware display label presets.
// Pure data — no Supabase imports. Safe to import from both Server and Client components.
// Never modify data structure or calculations — labels only.

import type { UserRegion } from './utils'

// ── Paycheck field labels ─────────────────────────────────────────────────────
// Keys match the Paycheck DB columns exactly.

type PaycheckLabelKey =
  | 'gross_pay'
  | 'federal_tax'
  | 'state_tax'
  | 'sdi'
  | 'other_deductions'
  | 'retirement_401k'
  | 'employer_401k_match'
  | 'net_pay'

export const PAYCHECK_FIELD_LABELS: Record<UserRegion, Record<PaycheckLabelKey, string>> = {
  US: {
    gross_pay: 'Gross Pay',
    federal_tax: 'Federal Tax',
    state_tax: 'State Tax',
    sdi: 'SDI',
    other_deductions: 'Other Deductions',
    retirement_401k: '401k Contribution',
    employer_401k_match: 'Employer 401k Match',
    net_pay: 'Net Pay',
  },
  IN: {
    gross_pay: 'Gross Pay (Basic + HRA + Allowances)',
    federal_tax: 'Income Tax (TDS)',
    state_tax: 'Professional Tax',
    sdi: 'ESI',
    other_deductions: 'Other Deductions',
    retirement_401k: 'PF Contribution',
    employer_401k_match: 'Employer PF Match',
    net_pay: 'Net Pay',
  },
  other: {
    gross_pay: 'Gross Pay',
    federal_tax: 'Federal Tax',
    state_tax: 'State Tax',
    sdi: 'SDI',
    other_deductions: 'Other Deductions',
    retirement_401k: '401k Contribution',
    employer_401k_match: 'Employer 401k Match',
    net_pay: 'Net Pay',
  },
}

// ── Tax-estimator category labels ─────────────────────────────────────────────
// Display names for the three broad tax categories shown on the tax-estimator page.

export const TAX_CATEGORY_LABELS: Record<
  UserRegion,
  { federal: string; state: string; fica: string }
> = {
  US:    { federal: 'Federal',           state: 'State', fica: 'FICA' },
  IN:    { federal: 'Income Tax Slab',   state: 'TDS',   fica: 'GST'  },
  other: { federal: 'Federal',           state: 'State', fica: 'FICA' },
}

// ── Retirement account labels ─────────────────────────────────────────────────
// Used wherever the UI mentions 401k / IRA (US) or PF / PPF / NPS (IN).

export const RETIREMENT_LABELS: Record<
  UserRegion,
  { plural: string; singular: string }
> = {
  US:    { plural: '401k / IRA',    singular: '401k' },
  IN:    { plural: 'PF / PPF / NPS', singular: 'PF'   },
  other: { plural: '401k / IRA',    singular: '401k' },
}
