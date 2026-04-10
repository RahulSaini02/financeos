"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import type { Investment, SavingsGoal } from "@/lib/types";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

function gainPct(invested: number, current: number): number {
  if (invested === 0) return 0;
  return ((current - invested) / invested) * 100;
}

function monthsToGoal(target: number, current: number, monthly: number): number {
  if (monthly <= 0 || current >= target) return 0;
  return Math.ceil((target - current) / monthly);
}

const typeColors: Record<string, { bg: string; text: string }> = {
  ETF: { bg: "bg-violet-500/10", text: "text-violet-400" },
  Stock: { bg: "bg-blue-500/10", text: "text-blue-400" },
  "401K": { bg: "bg-amber-500/10", text: "text-amber-400" },
  "401K (7584)": { bg: "bg-amber-500/10", text: "text-amber-400" },
};

function getTypeStyle(type: string) {
  return typeColors[type] ?? { bg: "bg-[var(--color-accent)]/10", text: "text-[var(--color-accent)]" };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      const [{ data: inv, error: invErr }, { data: goalsData, error: goalsErr }] =
        await Promise.all([
          supabase
            .from("investments")
            .select("*, account:accounts(id, name, current_balance)")
            .eq("user_id", user!.id)
            .order("current_value", { ascending: false }),
          supabase
            .from("savings_goals")
            .select("*, account:accounts!savings_goals_linked_account_id_fkey(id, name, current_balance)")
            .eq("user_id", user!.id)
            .order("created_at"),
        ]);

      if (invErr || goalsErr) {
        setError("Failed to load investments");
      } else {
        setInvestments(inv ?? []);
        setGoals(goalsData ?? []);
      }

      setIsLoading(false);
    }

    fetchData();
  }, [user]);

  // Use linked account balance as current value when account_id is set
  function effectiveValue(inv: Investment & { account?: { id: string; name: string; current_balance: number } | null }): number {
    const acct = inv.account as { current_balance?: number } | null
    return acct?.current_balance != null ? acct.current_balance : inv.current_value
  }

  const totals = useMemo(() => {
    const totalInvested = investments.reduce((s, i) => s + i.total_invested, 0);
    const totalValue = investments.reduce((s, i) => s + effectiveValue(i as Investment & { account?: { id: string; name: string; current_balance: number } | null }), 0);
    const totalGain = totalValue - totalInvested;
    const totalReturnPct = gainPct(totalInvested, totalValue);
    return { totalInvested, totalValue, totalGain, totalReturnPct };
  }, [investments]);

  // Group by platform
  const byPlatform = useMemo(() => {
    const map: Record<string, Investment[]> = {};
    investments.forEach((inv) => {
      if (!map[inv.platform]) map[inv.platform] = [];
      map[inv.platform].push(inv);
    });
    return map;
  }, [investments]);

  if (isLoading) return <GridPageSkeleton cards={4} />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Investments</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          Portfolio performance and savings goals
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardTitle>Portfolio Value</CardTitle>
          <CardValue className="mt-2">{formatCurrency(totals.totalValue)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total Invested</CardTitle>
          <CardValue className="mt-2">{formatCurrency(totals.totalInvested)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Total Gain / Loss</CardTitle>
          <CardValue
            className={`mt-2 ${
              totals.totalGain >= 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {totals.totalGain >= 0 ? "+" : ""}
            {formatCurrency(totals.totalGain)}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Total Return</CardTitle>
          <CardValue
            className={`mt-2 ${
              totals.totalReturnPct >= 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {totals.totalReturnPct >= 0 ? "+" : ""}
            {totals.totalReturnPct.toFixed(2)}%
          </CardValue>
        </Card>
      </div>

      {/* Holdings by platform */}
      {investments.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-[var(--color-text-muted)]">No investments found</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(byPlatform).map(([platform, positions]) => {
            const platformValue = positions.reduce(
              (s, i) => s + i.current_value,
              0
            );
            const platformInvested = positions.reduce(
              (s, i) => s + i.total_invested,
              0
            );
            const platformGain = platformValue - platformInvested;
            const platformPct = gainPct(platformInvested, platformValue);

            return (
              <div key={platform}>
                {/* Platform header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">{platform}</h2>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">
                      {formatCurrency(platformValue)}
                    </span>
                    <span
                      className={`flex items-center gap-0.5 font-medium ${
                        platformGain >= 0
                          ? "text-[var(--color-success)]"
                          : "text-[var(--color-danger)]"
                      }`}
                    >
                      {platformGain >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {platformPct >= 0 ? "+" : ""}
                      {platformPct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {positions.map((inv) => {
                    const invWithAcct = inv as Investment & { account?: { id: string; name: string; current_balance: number } | null }
                    const liveValue = effectiveValue(invWithAcct)
                    const gain = liveValue - inv.total_invested;
                    const pct = gainPct(inv.total_invested, liveValue);
                    const typeStyle = getTypeStyle(inv.type);
                    const isGain = gain >= 0;

                    return (
                      <Card key={inv.id}>
                        {/* Ticker + type */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-lg leading-none">
                              {inv.ticker}
                            </p>
                            <span
                              className={`mt-1 inline-block text-[0.65rem] font-medium px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}
                            >
                              {inv.type}
                            </span>
                          </div>
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${typeStyle.bg}`}
                          >
                            {isGain ? (
                              <TrendingUp className={`h-4 w-4 ${typeStyle.text}`} />
                            ) : (
                              <TrendingDown className={`h-4 w-4 ${typeStyle.text}`} />
                            )}
                          </div>
                        </div>

                        {/* Value */}
                        <p className="text-xl font-semibold">
                          {formatCurrency(liveValue)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Invested: {formatCurrency(inv.total_invested)}
                        </p>
                        {invWithAcct.account && (
                          <p className="text-[10px] text-[var(--color-accent)] mt-0.5">
                            ⟳ {invWithAcct.account.name}
                          </p>
                        )}

                        {/* Gain/loss pill */}
                        <div
                          className={`mt-3 flex items-center gap-1 text-xs font-medium ${
                            isGain
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-danger)]"
                          }`}
                        >
                          {isGain ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {isGain ? "+" : ""}
                          {formatCurrency(gain)} ({pct >= 0 ? "+" : ""}
                          {pct.toFixed(2)}%)
                        </div>

                        {/* Last updated */}
                        {inv.last_updated && (
                          <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-2">
                            Updated{" "}
                            {new Date(inv.last_updated).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric", year: "numeric" }
                            )}
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Savings Goals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Savings Goals</h2>
        </div>

        {goals.length === 0 ? (
          <Card className="py-10 text-center">
            <p className="text-[var(--color-text-muted)] text-sm">
              No savings goals yet
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => {
              const goalWithAcct = goal as typeof goal & { account?: { id: string; name: string; current_balance: number } | null }
              const effectiveCurrent = goalWithAcct.account?.current_balance ?? goal.current_amount
              const pct =
                goal.target_amount > 0
                  ? Math.min(
                      (effectiveCurrent / goal.target_amount) * 100,
                      100
                    )
                  : 0;
              const remaining = goal.target_amount - effectiveCurrent;
              const months = monthsToGoal(
                goal.target_amount,
                effectiveCurrent,
                goal.monthly_contribution
              );

              return (
                <Card key={goal.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {goal.icon && (
                        <span className="text-2xl">{goal.icon}</span>
                      )}
                      <div>
                        <p className="font-medium">{goal.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {goal.monthly_contribution > 0
                            ? `${formatCurrency(goal.monthly_contribution)} / mo`
                            : "No contribution set"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        goal.status === "completed"
                          ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                          : goal.status === "paused"
                          ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                          : "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      }`}
                    >
                      {goal.status}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xl font-semibold">
                        {formatCurrency(effectiveCurrent)}
                      </p>
                      {goalWithAcct.account && (
                        <p className="text-[10px] text-[var(--color-accent)]">⟳ {goalWithAcct.account.name}</p>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      / {formatCurrency(goal.target_amount)}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100
                          ? "bg-[var(--color-success)]"
                          : "bg-[var(--color-accent)]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-[var(--color-text-muted)]">
                    <span>{pct.toFixed(0)}% funded</span>
                    {remaining > 0 ? (
                      <span>
                        {formatCurrency(remaining)} to go
                        {months > 0 && ` · ~${months}mo`}
                      </span>
                    ) : (
                      <span className="text-[var(--color-success)]">
                        Goal reached!
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
