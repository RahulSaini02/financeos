import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GridPageSkeleton } from "@/components/ui/skeleton";
import CategoriesClient from "./categories-page-client";
import type { Category } from "@/lib/types";

export default async function CategoriesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  const initialCategories: Category[] = data ?? [];

  return (
    <Suspense fallback={<GridPageSkeleton cards={9} />}>
      <CategoriesClient initialCategories={initialCategories} />
    </Suspense>
  );
}
