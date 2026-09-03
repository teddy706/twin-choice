import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/CategoriesManager";
import { Topbar } from "@/components/Topbar";

export default async function CategoriesSettingsPage() {
  const profile = await requireProfile();
  // 커스터마이징은 부모 전용 — 자녀는 화면 자체가 없는 것처럼 홈으로 돌려보낸다.
  if (profile.role !== "parent") redirect("/home");

  const supabase = createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, emoji, is_active, sort_order")
    .eq("family_id", profile.family_id)
    .order("sort_order");

  const categoryIds = (categories ?? []).map((c) => c.id);
  const { data: items } = categoryIds.length
    ? await supabase.from("items").select("id, category_id").eq("is_active", true).in("category_id", categoryIds)
    : { data: [] };

  const itemCountByCategory: Record<string, number> = {};
  for (const it of items ?? []) {
    itemCountByCategory[it.category_id] = (itemCountByCategory[it.category_id] ?? 0) + 1;
  }

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <Link href="/settings" className="mb-1.5 inline-block text-sm text-soft">← 설정</Link>
      <h2 className="mb-3.5 text-[19px] font-bold">🗂️ 카테고리 관리</h2>
      <CategoriesManager
        familyId={profile.family_id}
        initialCategories={categories ?? []}
        itemCountByCategory={itemCountByCategory}
      />
    </div>
  );
}
