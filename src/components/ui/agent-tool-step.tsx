"use client";

import { Loader2, Check, X } from "lucide-react";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_spending_trends: "Analyzing spending trends",
  query_spending: "Analyzing transactions",
  get_budget_status: "Checking budgets",
  get_savings_goals: "Reviewing savings goals",
  get_loan_details: "Looking up loan details",
  get_subscription_list: "Checking subscriptions",
  create_transaction: "Creating transaction",
  flag_transaction: "Flagging transaction",
  update_budget: "Updating budget",
  create_savings_goal: "Creating savings goal",
};

interface AgentToolStepProps {
  toolName: string;
  status: "running" | "done" | "error";
  summary?: string;
  errorMessage?: string;
}

export function AgentToolStep({
  toolName,
  status,
  summary,
  errorMessage,
}: AgentToolStepProps) {
  const displayName = TOOL_DISPLAY_NAMES[toolName] ?? toolName;

  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] py-1">
      {status === "running" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
          <span>{displayName}…</span>
        </>
      )}
      {status === "done" && (
        <>
          <Check className="h-3.5 w-3.5 text-[var(--color-success)] flex-shrink-0" />
          <span className="text-[var(--color-text-secondary)]">
            {displayName}
            {summary ? ` — ${summary}` : ""}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <X className="h-3 w-3 text-[var(--color-danger)] flex-shrink-0" />
          <span className="text-[var(--color-danger)]">
            {displayName}
            {errorMessage ? ` — ${errorMessage}` : " — failed"}
          </span>
        </>
      )}
    </div>
  );
}
