import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { RoundView } from "@/components/RoundView";

export default async function RoundPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: round } = await supabase
    .from("rounds")
    .select("id, family_id, category_id, status, expected_participants, started_by")
    .eq("id", params.id)
    .maybeSingle();

  if (!round) notFound();

  const [{ data: category }, { data: items }, { data: familyProfiles }, { data: choices }, { data: resolution }] =
    await Promise.all([
      supabase.from("categories").select("id, name, emoji").eq("id", round.category_id).maybeSingle(),
      supabase.from("items").select("id, name, emoji").eq("category_id", round.category_id).eq("is_active", true).order("sort_order"),
      supabase.from("profiles").select("id, name, avatar, role").eq("family_id", round.family_id),
      supabase.from("choices").select("id, profile_id, item_id, submitted_at").eq("round_id", round.id),
      supabase.from("resolutions").select("*").eq("round_id", round.id).maybeSingle(),
    ]);

  return (
    <RoundView
      profile={profile}
      round={round}
      category={category ?? null}
      items={items ?? []}
      familyProfiles={familyProfiles ?? []}
      initialChoices={choices ?? []}
      initialResolution={resolution ?? null}
    />
  );
}
