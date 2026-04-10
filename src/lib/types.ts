// Mirrors supabase/migrations/001_initial_schema.sql exactly.
// Re-export from here everywhere in the app — never import from Supabase directly.

export type AccountKind = 'asset' | 'liability' | 'investment'
export type AccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'investment' | 'retirement'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type CrDr = 'credit' | 'debit'
export type TxnSource = 'manual' | 'import' | 'n8n' | 'apple_pay'
export type ImportStatus = 'pending' | 'confirmed' | 'flagged' | 'rejected'
export type CurrencyCode = 'USD' | 'INR'
export type BillingStatus = 'active' | 'inactive' | 'cancelled'
export type LoanType = 'student' | 'personal' | 'mortgage' | 'auto' | 'other'
export type GoalStatus = 'active' | 'paused' | 'completed'
export type InsightType = 'daily' | 'monthly' | 'alert'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  default_currency: CurrencyCode
  theme: 'dark' | 'light'
  created_at: string
  updated_at: string
}

export interface ExchangeRate {
  id: string
  from_currency: CurrencyCode
  to_currency: CurrencyCode
  rate: number
  fetched_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  kind: AccountKind
  institution: string | null
  last_four: string | null
  currency: CurrencyCode
  current_balance: number
  opening_balance: number
  is_active: boolean
  is_india_account: boolean
  notes: string | null
  last_updated: string | null
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  parent_name: string | null
  type: TransactionType
  icon: string | null
  monthly_budget: number | null
  is_recurring: boolean
  due_day: number | null
  priority: 'high' | 'medium' | 'low' | null
  notes: string | null
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  description: string
  amount_usd: number
  amount_original: number | null
  original_currency: CurrencyCode
  cr_dr: CrDr
  final_amount: number
  date: string
  notes: string | null
  is_recurring: boolean
  recurring_rule_id: string | null
  source: TxnSource
  import_status: ImportStatus
  flagged: boolean
  flagged_reason: string | null
  ai_categorized: boolean
  ai_confidence: number | null
  loan_id: string | null
  transfer_group_id: string | null
  linked_transaction_id: string | null
  is_internal_transfer: boolean
  created_at: string
  updated_at: string
  account?: Account
  category?: Category
}

export interface RecurringRule {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  description: string
  amount_usd: number
  cr_dr: CrDr
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  day_of_month: number | null
  next_due: string
  last_generated: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface Employer {
  id: string
  user_id: string
  name: string
  alias: string | null
  location: string | null
  manager: string | null
  ein: string | null
  phone: string | null
  hr_contact: string | null
  my_start_date: string | null
  grade: string | null
  default_account_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Paycheck {
  id: string
  user_id: string
  account_id: string
  employer: string
  employer_id: string | null
  date: string
  gross_pay: number
  federal_tax: number
  state_tax: number
  sdi: number
  other_deductions: number
  retirement_401k: number
  net_pay: number
  is_current_month: boolean
  notes: string | null
  transaction_id: string | null
  created_at: string
  employer_record?: Employer
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  month: string
  amount_usd: number
  created_at: string
  category?: Category
}

export interface Loan {
  id: string
  user_id: string
  account_id: string
  name: string
  type: LoanType
  principal: number
  interest_rate: number
  term_months: number
  emi: number
  start_date: string
  current_balance: number
  notes: string | null
  created_at: string
}

export interface LoanPayment {
  id: string
  loan_id: string
  payment_date: string
  opening_balance: number
  emi_paid: number
  interest: number
  principal_paid: number
  closing_balance: number
  created_at: string
}

export interface Investment {
  id: string
  user_id: string
  account_id: string | null
  type: string
  platform: string
  ticker: string
  total_invested: number
  current_value: number
  last_updated: string | null
  notes: string | null
  created_at: string
}

export interface SavingsGoal {
  id: string
  user_id: string
  linked_account_id: string | null
  name: string
  icon: string | null
  target_amount: number
  current_amount: number
  monthly_contribution: number
  status: GoalStatus
  notes: string | null
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  category_id: string | null
  name: string
  billing_cost: number
  billing_cycle_months: number
  billing_start_date: string | null
  next_billing_date: string | null
  status: BillingStatus
  auto_renew: boolean
  notes: string | null
  created_at: string
}

export interface NetworthSnapshot {
  id: string
  user_id: string
  month: string
  assets_total: number
  liabilities_total: number
  net_worth: number
  created_at: string
}

export interface PendingImport {
  id: string
  user_id: string
  raw_data: Record<string, unknown>
  parsed_merchant: string | null
  parsed_amount: number | null
  parsed_date: string | null
  parsed_last_four: string | null
  source: TxnSource
  status: ImportStatus
  suggested_category_id: string | null
  suggested_account_id: string | null
  ai_notes: string | null
  flagged: boolean
  flagged_reason: string | null
  transaction_id: string | null
  created_at: string
  reviewed_at: string | null
}

export interface AiInsight {
  id: string
  user_id: string
  type: InsightType
  content: string
  month: string | null
  is_read: boolean
  created_at: string
}

export interface BudgetWithActual extends Budget {
  actual_spend: number
  remaining: number
  progress_status: 'on_track' | 'over_budget' | 'no_spend'
  category: Category
}

export interface AccountWithDelta extends Account {
  balance_change_30d: number
}

export interface DashboardSummary {
  net_worth: number
  total_assets: number
  total_liabilities: number
  monthly_income: number
  monthly_expenses: number
  flagged_count: number
  pending_import_count: number
  upcoming_bills: Array<{
    name: string
    due_date: string
    amount: number
    paid: boolean
  }>
  networth_trend: NetworthSnapshot[]
  latest_insight: AiInsight | null
}
