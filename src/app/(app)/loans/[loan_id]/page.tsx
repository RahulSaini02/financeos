import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LoanDetailClient } from "./LoanDetailClient";
import type { Loan, LoanPayment, Transaction } from "@/lib/types";

interface LoanWithDetails extends Loan {
  payments: LoanPayment[];
  transactions: Transaction[];
  account?: { name: string } | null;
}

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ loan_id: string }>;
}) {
  const { loan_id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: loanData, error: loanErr },
    { data: payments },
    { data: transactions },
  ] = await Promise.all([
    supabase
      .from("loans")
      .select("*, account:accounts(name)")
      .eq("id", loan_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("loan_payments")
      .select("*")
      .eq("loan_id", loan_id)
      .order("payment_date", { ascending: false }),
    supabase
      .from("transactions")
      .select("*, account:accounts(name)")
      .eq("user_id", user.id)
      .eq("loan_id", loan_id)
      .order("date", { ascending: false }),
  ]);

  if (loanErr || !loanData) {
    notFound();
  }

  const loan: LoanWithDetails = {
    ...(loanData as unknown as Loan),
    account: (loanData as { account?: { name: string } | null }).account ?? null,
    payments: (payments ?? []) as LoanPayment[],
    transactions: (transactions ?? []) as Transaction[],
  };

  return <LoanDetailClient loan={loan} />;
}
