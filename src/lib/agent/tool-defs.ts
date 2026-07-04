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
]

export const WRITE_TOOL_NAMES: string[] = WRITE_TOOLS.map((t) => t.name)
