import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { HistoryView } from "@/components/HistoryView";

export default async function HistoryPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: categories }, { data: resolutions }, { data: profiles }, { data: items }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, emoji")
      .eq("family_id", profile.family_id)
      .order("sort_order"),
    supabase
      .from("resolutions")
      .select("id, round_id, type, winner_profile_id, resolved_at, rounds!inner(id, family_id, category_id)")
      .eq("rounds.family_id", profile.family_id)
      .order("resolved_at", { ascending: false }),
    supabase.from("profiles").select("id, name, avatar").eq("family_id", profile.family_id),
    supabase.from("items").select("id, name, emoji, category_id"),
  ]);

  const roundIds = (resolutions ?? []).map((r: any) => r.round_id);
  const { data: choices } = roundIds.length
    ? await supabase.from("choices").select("round_id, profile_id, item_id").in("round_id", roundIds)
    : { data: [] };

  return (
    <HistoryView
      profile={profile}
      categories={categories ?? []}
      resolutions={(resolutions ?? []) as any}
      profiles={profiles ?? []}
      items={items ?? []}
      choices={choices ?? []}
    />
  );
}
