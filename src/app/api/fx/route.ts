import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getFxRate } from "@/lib/fx";
import { NextResponse } from "next/server";
import type { CurrencyCode } from "@/lib/types";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const from = (url.searchParams.get("from") ?? "USD") as CurrencyCode;
  const to = (url.searchParams.get("to") ?? "INR") as CurrencyCode;

  const rate = await getFxRate(from, to);
  return NextResponse.json({ rate: rate ?? 84 });
}
