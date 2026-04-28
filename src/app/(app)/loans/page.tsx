import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LoansClient } from "./LoansClient";
import type { Loan, LoanPayment, Account } from "@/lib/types";

interface LoanWithPayments extends Loan {
  payments: LoanPayment[];
}

export default async function LoansPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: loanData }, { data: paymentsData }, { data: accountsData }] = await Promise.all([
    supabase
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .order("current_balance", { ascending: false }),
    supabase
      .from("loan_payments")
      .select("*")
      .order("payment_date", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("kind", "asset")
      .order("name"),
  ]);

  const loans: LoanWithPayments[] = (loanData ?? []).map((loan) => ({
    ...(loan as Loan),
    payments: ((paymentsData ?? []) as LoanPayment[]).filter((p) => p.loan_id === loan.id),
  }));

  return (
    <LoansClient
      initialLoans={loans}
      accounts={(accountsData ?? []) as Account[]}
    />
  );
}
