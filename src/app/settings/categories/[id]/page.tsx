import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { ItemsManager } from "@/components/ItemsManager";
import { Topbar } from "@/components/Topbar";

export default async function CategoryItemsPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  if (profile.role !== "parent") redirect("/home");

  const supabase = createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id, family_id, name, emoji")
    .eq("id", params.id)
    .maybeSingle();

  if (!category || category.family_id !== profile.family_id) notFound();

  const { data: items } = await supabase
    .from("items")
    .select("id, name, emoji, is_active, sort_order")
    .eq("category_id", category.id)
    .order("sort_order");

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <h2 className="mb-3.5 text-[19px] font-bold">
        {category.emoji} {category.name} — 항목 관리
      </h2>
      <ItemsManager categoryId={category.id} initialItems={items ?? []} />
    </div>
  );
}
