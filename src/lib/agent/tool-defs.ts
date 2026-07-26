// src/lib/agent/tool-defs.ts
// Anthropic tool definitions/schemas for the FinanceOS agent.

import Anthropic from '@anthropic-ai/sdk'

export const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_financial_summary',
    description:
      'Returns a complete financial overview: net worth, accounts with balances, this month income/expenses/savings rate, top 5 spending categories, active loans, investment portfolio, subscriptions monthly cost, savings goals, and upcoming calendar events (next 7 days). Call this FIRST for any general financial question before using specific query tools.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_account_balances',
    description:
      'Returns current balances for all active accounts (checking, savings, credit cards, investments). Use when the user asks about a specific account balance or total assets/liabilities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        kind: {
          type: 'string',
          enum: ['asset', 'liability', 'investment', 'all'],
          description: 'Filter by account kind. Default: all',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_spending_trends',
    description:
      'Returns month-by-month spending broken down by category for the past N months. Use when the user asks about trends, patterns, or how their spending has changed over time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        months_back: {
          type: 'number',
          description: 'How many months of history to return (1–12). Default: 3.',
        },
        category: {
          type: 'string',
          description: 'Optional category name filter (partial match, case-insensitive)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_spending',
    description:
      "Query the user's transactions for a date range. Returns total spend/income, transaction count, and individual transactions. Use whenever the user asks about spending in any time period.",
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        category: {
          type: 'string',
          description: 'Optional category name filter (partial match, case-insensitive)',
        },
        cr_dr: {
          type: 'string',
          enum: ['credit', 'debit'],
          description: 'credit=income, debit=expense. Omit for both.',
        },
        limit: {
          type: 'number',
          description: 'Max transactions to return. Default 20, max 100.',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_budget_status',
    description:
      'Returns all budget categories for a given month with actual spend, budget amount, remaining, and over/under status. Use when the user asks if they are on track or over budget.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: {
          type: 'string',
          description: 'Month as YYYY-MM-01. Defaults to current month if omitted.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_savings_goals',
    description:
      'Returns all savings goals with current progress, target amount, monthly contribution, and projected completion date. Use when the user asks about savings goals or financial targets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'all'],
          description: 'Filter by status. Default: active',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_loan_details',
    description:
      'Returns detailed loan information: current balance, interest rate, EMI, months remaining, and payoff date projection. Use when the user asks about debt payoff, loan progress, or interest costs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        loan_name: {
          type: 'string',
          description: 'Optional partial name match to filter a specific loan',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_subscription_list',
    description:
      'Returns subscriptions with billing cost, cycle, next billing date, and total monthly cost. Use when the user asks about recurring charges or subscriptions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'cancelled', 'all'],
          description: 'Filter by status. Default: active',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_investments',
    description:
      'Returns the investment portfolio: each holding with ticker, platform, total invested, current value, and gain/loss. Use when the user asks about investments, stocks, portfolio performance, or returns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: {
          type: 'string',
          description: 'Optional ticker or platform filter (partial match, case-insensitive)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_paychecks',
    description:
      'Returns paychecks with gross pay, taxes, 401k contributions, and net pay for a date range. Use when the user asks about income, salary, paychecks, tax withholding, or 401k contributions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD. Default: 3 months ago.' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD. Default: today.' },
        limit: { type: 'number', description: 'Max paychecks to return. Default 10, max 50.' },
      },
      required: [],
    },
  },
  {
    name: 'get_recurring_rules',
    description:
      'Returns recurring transaction rules (scheduled bills, income, transfers) with amount, frequency, and next due date. Use when the user asks about upcoming bills, scheduled payments, or recurring income.',
    input_schema: {
      type: 'object' as const,
      properties: {
        active_only: {
          type: 'boolean',
          description: 'Only return active rules. Default: true',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_categories',
    description:
      "Returns the user's transaction categories with type (expense/income/transfer) and monthly budget if set. Use to see what categories exist before categorizing or budgeting.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_networth_history',
    description:
      'Returns monthly net worth snapshots (assets, liabilities, net worth) over time. Use when the user asks how their net worth has changed or trended.',
    input_schema: {
      type: 'object' as const,
      properties: {
        months_back: {
          type: 'number',
          description: 'How many months of history to return (1–36). Default: 12.',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_transactions',
    description:
      'Search transactions by description text, with optional date range and account filter. Returns matching transactions WITH THEIR IDs. Use this to find a specific transaction before updating or flagging it, or when a previous write attempt reported multiple matches.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Text to search in transaction descriptions (partial match, case-insensitive)' },
        start_date: { type: 'string', description: 'Optional start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Optional end date YYYY-MM-DD' },
        account_name: { type: 'string', description: 'Optional account name filter (partial match)' },
        limit: { type: 'number', description: 'Max results. Default 10, max 25.' },
      },
      required: ['query'],
    },
  },
]

export const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_transaction',
    description:
      'Log a manual transaction to the user\'s account. ALWAYS present the details (account, amount, description, date) and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        account_name: { type: 'string', description: 'Partial account name to look up (e.g. "Chase Checking")' },
        description: { type: 'string', description: 'Transaction description / merchant name' },
        amount_usd: { type: 'number', description: 'Positive amount in USD' },
        cr_dr: {
          type: 'string',
          enum: ['credit', 'debit'],
          description: 'credit=income/deposit, debit=expense/payment',
        },
        date: { type: 'string', description: 'Transaction date YYYY-MM-DD. Defaults to today.' },
        category_name: { type: 'string', description: 'Optional category name (partial match)' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['account_name', 'description', 'amount_usd', 'cr_dr'],
    },
  },
  {
    name: 'flag_transaction',
    description:
      'Flag or unflag a transaction with an optional reason. Use when the user wants to mark a transaction as suspicious, incorrect, or worth revisiting. If multiple transactions match, you will receive the candidates — use search_transactions or ask the user, then call again with transaction_id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transaction_id: { type: 'string', description: 'Exact transaction ID (from search_transactions or a previous candidates list). Preferred when known.' },
        description: { type: 'string', description: 'Partial description to search for the transaction (used when transaction_id is not known)' },
        date: { type: 'string', description: 'Optional transaction date YYYY-MM-DD to narrow the search' },
        flagged: { type: 'boolean', description: 'true to flag, false to unflag' },
        reason: { type: 'string', description: 'Optional reason for flagging' },
      },
      required: ['flagged'],
    },
  },
  {
    name: 'update_transaction',
    description:
      'Update a transaction: change its category, description, or notes. Use when the user wants to recategorize or correct a transaction. If multiple transactions match, you will receive the candidates — narrow down and call again with transaction_id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transaction_id: { type: 'string', description: 'Exact transaction ID (from search_transactions or a previous candidates list). Preferred when known.' },
        description: { type: 'string', description: 'Partial description to find the transaction (used when transaction_id is not known)' },
        date: { type: 'string', description: 'Optional transaction date YYYY-MM-DD to narrow the search' },
        new_category_name: { type: 'string', description: 'New category name to assign (partial match against user categories)' },
        new_description: { type: 'string', description: 'New description text' },
        new_notes: { type: 'string', description: 'New notes' },
      },
      required: [],
    },
  },
  {
    name: 'update_budget',
    description:
      'Set or update a monthly budget amount for a specific category. ALWAYS present the details and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category_name: { type: 'string', description: 'The category name to update budget for' },
        amount_usd: { type: 'number', description: 'New monthly budget amount in USD' },
        month: { type: 'string', description: 'Month as YYYY-MM-01. Defaults to current month.' },
      },
      required: ['category_name', 'amount_usd'],
    },
  },
  {
    name: 'create_savings_goal',
    description:
      'Create a new savings goal. ALWAYS present the details and get user confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Goal name, e.g. Emergency Fund' },
        target_amount: { type: 'number', description: 'Target amount in USD' },
        monthly_contribution: {
          type: 'number',
          description: 'Planned monthly contribution in USD. Default 0.',
        },
        current_amount: { type: 'number', description: 'Current saved amount. Default 0.' },
        icon: { type: 'string', description: 'Optional emoji icon' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['name', 'target_amount'],
    },
  },
  {
    name: 'update_savings_goal',
    description:
      'Update an existing savings goal: log a contribution (add_amount), change the monthly contribution or target, or pause/resume/complete it. Use when the user wants to add money to a goal or adjust it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_name: { type: 'string', description: 'Goal name to look up (partial match)' },
        add_amount: { type: 'number', description: 'Amount in USD to ADD to the current saved amount (a contribution)' },
        monthly_contribution: { type: 'number', description: 'New planned monthly contribution in USD' },
        target_amount: { type: 'number', description: 'New target amount in USD' },
        status: { type: 'string', enum: ['active', 'paused', 'completed'], description: 'New status' },
      },
      required: ['goal_name'],
    },
  },
  {
    name: 'update_subscription',
    description:
      'Update a subscription: change its status (cancel, deactivate, reactivate), billing cost, or auto-renew flag. Use when the user wants to cancel or modify a subscription.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subscription_name: { type: 'string', description: 'Subscription name to look up (partial match)' },
        status: { type: 'string', enum: ['active', 'inactive', 'cancelled'], description: 'New status' },
        billing_cost: { type: 'number', description: 'New billing cost in USD per cycle' },
        auto_renew: { type: 'boolean', description: 'New auto-renew setting' },
      },
      required: ['subscription_name'],
    },
  },
  {
    name: 'transfer_funds',
    description:
      "Transfer money between two of the user's accounts. Creates paired debit+credit transactions linked by a transfer group. Use when the user asks to move, transfer, or send money between accounts.",
    input_schema: {
      type: 'object' as const,
      properties: {
        from_account: { type: 'string', description: 'Source account name (partial match)' },
        to_account: { type: 'string', description: "Destination account name (partial match)" },
        amount: { type: 'number', description: "Amount to transfer in source account's native currency (positive)" },
        date: { type: 'string', description: 'Transfer date YYYY-MM-DD. Defaults to today.' },
        description: { type: 'string', description: 'Optional description for the transfer entries' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['from_account', 'to_account', 'amount'],
    },
  },
  {
    name: 'delete_transaction',
    description:
      'Delete a transaction permanently. If it is part of a transfer, both legs are removed. Use when the user asks to remove, undo, or delete a transaction. Requires confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transaction_id: { type: 'string', description: 'Exact transaction UUID (from search_transactions or a prior candidates list). Use this when known.' },
        description: { type: 'string', description: 'Partial description to find the transaction when transaction_id is unknown' },
        date: { type: 'string', description: 'Optional transaction date YYYY-MM-DD to narrow the search' },
      },
      required: [],
    },
  },
  {
    name: 'create_account',
    description:
      'Create a new financial account (checking, savings, credit card, investment, etc.). Use when the user wants to add a new account to track.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Account name, e.g. Chase Checking' },
        type: {
          type: 'string',
          enum: ['checking', 'savings', 'credit_card', 'loan', 'investment', 'retirement'],
          description: 'Account type',
        },
        kind: {
          type: 'string',
          enum: ['asset', 'liability', 'investment'],
          description: 'asset=bank/cash, liability=credit cards/loans, investment=brokerage/retirement',
        },
        institution: { type: 'string', description: 'Bank or institution name (optional)' },
        currency: { type: 'string', description: 'ISO 4217 currency code, e.g. USD, INR. Default: USD' },
        current_balance: { type: 'number', description: 'Opening/current balance. Default 0.' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['name', 'type', 'kind'],
    },
  },
  {
    name: 'update_account',
    description:
      'Update an existing account: rename it, change the institution, or correct the current balance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        account_name: { type: 'string', description: 'Current account name to look up (partial match)' },
        new_name: { type: 'string', description: 'New account name' },
        institution: { type: 'string', description: 'New institution name' },
        current_balance: { type: 'number', description: 'Corrected current balance (overrides the computed balance)' },
        notes: { type: 'string', description: 'New notes (replaces existing)' },
      },
      required: ['account_name'],
    },
  },
  {
    name: 'create_subscription',
    description:
      'Create a new subscription to track a recurring charge (streaming, SaaS, gym, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Subscription name, e.g. Netflix' },
        billing_cost: { type: 'number', description: 'Cost per billing cycle in USD' },
        billing_cycle_months: { type: 'number', description: 'How often it bills in months (1=monthly, 12=annually). Default 1.' },
        next_billing_date: { type: 'string', description: 'Next billing date YYYY-MM-DD (optional)' },
        auto_renew: { type: 'boolean', description: 'Whether it auto-renews. Default true.' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['name', 'billing_cost'],
    },
  },
  {
    name: 'delete_subscription',
    description:
      'Permanently delete a subscription record. To cancel without losing history, use update_subscription with status=cancelled instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subscription_name: { type: 'string', description: 'Subscription name to look up (partial match)' },
      },
      required: ['subscription_name'],
    },
  },
  {
    name: 'log_subscription_payment',
    description:
      'Mark a subscription as paid for this billing cycle, advancing its next billing date forward by one cycle.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subscription_name: { type: 'string', description: 'Subscription name to look up (partial match)' },
        payment_date: { type: 'string', description: 'Payment date YYYY-MM-DD (defaults to today)' },
      },
      required: ['subscription_name'],
    },
  },
  {
    name: 'log_loan_payment',
    description:
      "Log a loan payment, reducing the loan's outstanding balance. Optionally creates a matching debit transaction if the user specifies which account was debited.",
    input_schema: {
      type: 'object' as const,
      properties: {
        loan_name: { type: 'string', description: 'Loan name to look up (partial match)' },
        payment_amount: { type: 'number', description: 'Payment amount in USD (positive)' },
        date: { type: 'string', description: 'Payment date YYYY-MM-DD. Defaults to today.' },
        from_account_name: { type: 'string', description: 'Optional account to create a matching debit transaction (partial match)' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['loan_name', 'payment_amount'],
    },
  },
  {
    name: 'delete_savings_goal',
    description:
      'Permanently delete a savings goal. To pause or complete instead, use update_savings_goal with status=paused or status=completed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_name: { type: 'string', description: 'Savings goal name to look up (partial match)' },
      },
      required: ['goal_name'],
    },
  },
  {
    name: 'create_investment',
    description:
      'Add a new investment holding to the portfolio tracker (stock, ETF, crypto, mutual fund, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol or asset name, e.g. AAPL, BTC' },
        type: { type: 'string', description: 'Investment type, e.g. stock, etf, crypto, mutual_fund, bond, other' },
        platform: { type: 'string', description: 'Platform or broker, e.g. Fidelity, Robinhood, Coinbase' },
        total_invested: { type: 'number', description: 'Total amount invested in USD' },
        current_value: { type: 'number', description: 'Current market value in USD' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['ticker', 'type', 'platform', 'total_invested', 'current_value'],
    },
  },
  {
    name: 'update_investment',
    description:
      "Update an investment holding: refresh its current market value, adjust total invested, or add notes.",
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker_or_platform: { type: 'string', description: 'Ticker symbol or platform to look up the investment (partial match)' },
        current_value: { type: 'number', description: 'New current market value in USD' },
        total_invested: { type: 'number', description: 'New total invested amount in USD' },
        notes: { type: 'string', description: 'New notes (replaces existing)' },
      },
      required: ['ticker_or_platform'],
    },
  },
  {
    name: 'delete_investment',
    description:
      'Delete an investment holding from the portfolio tracker. Use when the user has sold an investment and no longer wants to track it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker_or_platform: { type: 'string', description: 'Ticker symbol or platform to look up the investment (partial match)' },
      },
      required: ['ticker_or_platform'],
    },
  },
  {
    name: 'create_paycheck',
    description:
      'Log a paycheck with gross pay, tax withholding, and 401k details. Optionally creates a deposit transaction to the specified account for the net pay.',
    input_schema: {
      type: 'object' as const,
      properties: {
        employer: { type: 'string', description: 'Employer name' },
        date: { type: 'string', description: 'Paycheck date YYYY-MM-DD' },
        gross_pay: { type: 'number', description: 'Gross pay before deductions in USD' },
        net_pay: { type: 'number', description: 'Take-home net pay in USD' },
        federal_tax: { type: 'number', description: 'Federal income tax withheld. Default 0.' },
        state_tax: { type: 'number', description: 'State income tax withheld. Default 0.' },
        sdi: { type: 'number', description: 'SDI/disability withheld. Default 0.' },
        retirement_401k: { type: 'number', description: 'Employee 401k contribution. Default 0.' },
        employer_401k_match: { type: 'number', description: 'Employer 401k match. Default 0.' },
        other_deductions: { type: 'number', description: 'Other pre-tax deductions. Default 0.' },
        deposit_account_name: { type: 'string', description: 'Account to credit with the net pay deposit (partial match, optional)' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['employer', 'date', 'gross_pay', 'net_pay'],
    },
  },
  {
    name: 'create_recurring_rule',
    description:
      'Create a recurring transaction rule — a scheduled payment or income that repeats at a fixed interval (rent, salary, utilities). The cron job generates transactions automatically on each due date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'Rule description / merchant name' },
        amount_usd: { type: 'number', description: 'Transaction amount in USD (positive)' },
        cr_dr: { type: 'string', enum: ['credit', 'debit'], description: 'credit=income, debit=expense/payment' },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'yearly'],
          description: 'How often the rule fires',
        },
        next_due: { type: 'string', description: 'Next due date YYYY-MM-DD' },
        account_name: { type: 'string', description: 'Account to debit/credit (partial match)' },
        category_name: { type: 'string', description: 'Optional category name (partial match)' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['description', 'amount_usd', 'cr_dr', 'frequency', 'next_due', 'account_name'],
    },
  },
  {
    name: 'update_recurring_rule',
    description:
      'Update an existing recurring rule: change the amount, frequency, next due date, activate/pause it, or reassign its category.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rule_description: { type: 'string', description: 'Current rule description to look up (partial match)' },
        new_description: { type: 'string', description: 'New description for the rule' },
        amount_usd: { type: 'number', description: 'New amount in USD' },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'yearly'],
          description: 'New frequency',
        },
        next_due: { type: 'string', description: 'New next due date YYYY-MM-DD' },
        is_active: { type: 'boolean', description: 'true to activate, false to pause' },
        category_name: { type: 'string', description: 'New category name (partial match)' },
      },
      required: ['rule_description'],
    },
  },
  {
    name: 'delete_recurring_rule',
    description:
      'Permanently delete a recurring rule. Future transactions will no longer be generated. Use update_recurring_rule with is_active=false to pause without deleting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rule_description: { type: 'string', description: 'Rule description to look up (partial match)' },
      },
      required: ['rule_description'],
    },
  },
]

export const WRITE_TOOL_NAMES: string[] = WRITE_TOOLS.map((t) => t.name)
