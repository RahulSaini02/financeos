"use client";

import { Loader2, Check, Zap, TrendingUp, Target, Receipt, Flag } from "lucide-react";

interface AgentConfirmCardProps {
  actionId: string;
  toolName: string;
  preview: string;
  onConfirm: (actionId: string) => Promise<void>;
  onCancel: (actionId: string) => void;
  isConfirming?: boolean;
}

function ToolIcon({ toolName }: { toolName: string }) {
  const cls = "h-3.5 w-3.5 text-[var(--color-warning)]";
  if (toolName === "update_budget") return <TrendingUp className={cls} />;
  if (toolName === "create_savings_goal") return <Target className={cls} />;
  if (toolName === "create_transaction") return <Receipt className={cls} />;
  if (toolName === "flag_transaction") return <Flag className={cls} />;
  return <Zap className={cls} />;
}

export function AgentConfirmCard({
  actionId,
  toolName,
  preview,
  onConfirm,
  onCancel,
  isConfirming = false,
}: AgentConfirmCardProps) {
  return (
    <div className="flex items-start gap-2">
      {/* Bot avatar */}
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)]/10">
        <ToolIcon toolName={toolName} />
      </div>
      <div
        className="rounded-2xl rounded-tl-sm border max-w-[85%] overflow-hidden"
        style={{
          borderColor: "color-mix(in srgb, var(--color-warning) 40%, transparent)",
          background: "color-mix(in srgb, var(--color-warning) 5%, transparent)",
        }}
      >
        {/* Top gradient bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[var(--color-warning)]/0 via-[var(--color-warning)]/60 to-[var(--color-warning)]/0" />

        <div className="px-4 py-3">
          {/* Header badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <ToolIcon toolName={toolName} />
            <span
              className="text-[0.65rem] font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-warning)" }}
            >
              Action Required
            </span>
          </div>

          {/* Preview text */}
          <p
            className="text-sm mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            {preview}
          </p>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(actionId)}
              disabled={isConfirming}
              className="text-xs font-medium px-4 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-opacity shadow-sm"
              style={{ background: "var(--color-success)", color: "#fff" }}
            >
              {isConfirming ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Confirm
            </button>
            <button
              onClick={() => onCancel(actionId)}
              disabled={isConfirming}
              className="text-xs font-medium px-4 py-1.5 rounded-lg border disabled:opacity-50 transition-opacity"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
