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

  // "사진으로 고르기" 자유 라벨 중 이 카테고리에서 반복해서 나온 걸 부모에게 항목 추가로 제안한다.
  // item_id가 null인(=그리드가 아니라 사진/자유입력으로 고른) choices만 대상.
  const { data: freeLabelChoices } = await supabase
    .from("choices")
    .select("label, rounds!inner(category_id)")
    .eq("rounds.category_id", category.id)
    .is("item_id", null);

  const existingNames = new Set((items ?? []).map((i) => i.name.trim().toLowerCase()));
  const labelCounts = new Map<string, number>();
  for (const c of freeLabelChoices ?? []) {
    const label = c.label?.trim();
    if (!label || existingNames.has(label.toLowerCase())) continue;
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const MIN_LABEL_COUNT = 3;
  const suggestedItems = [...labelCounts.entries()]
    .filter(([, count]) => count >= MIN_LABEL_COUNT)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <h2 className="mb-3.5 text-[19px] font-bold">
        {category.emoji} {category.name} — 항목 관리
      </h2>
      <ItemsManager categoryId={category.id} initialItems={items ?? []} suggestedItems={suggestedItems} />
    </div>
  );
}
