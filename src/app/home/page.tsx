import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { HomeView } from "@/components/HomeView";

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: activeRound } = await supabase
    .from("rounds")
    .select("id, category_id, started_by, status, created_at, categories(name, emoji)")
    .eq("family_id", profile.family_id)
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let myChoiceSubmitted = false;
  if (activeRound) {
    const { data: myChoice } = await supabase
      .from("choices")
      .select("id")
      .eq("round_id", activeRound.id)
      .eq("profile_id", profile.id)
      .maybeSingle();
    myChoiceSubmitted = !!myChoice;
  }

  let starterName: string | null = null;
  if (activeRound && activeRound.started_by && activeRound.started_by !== profile.id) {
    const { data: starter } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", activeRound.started_by)
      .maybeSingle();
    starterName = starter?.name ?? null;
  }

  return (
    <HomeView
      profile={profile}
      activeRound={activeRound as any}
      myChoiceSubmitted={myChoiceSubmitted}
      starterName={starterName}
    />
  );
}
