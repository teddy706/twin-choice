import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Topbar } from "@/components/Topbar";

export default async function NewRoundPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, emoji")
    .eq("family_id", profile.family_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <h2 className="mb-3.5 text-[19px] font-bold">어떤 걸 고를까요?</h2>
      <CategoryPicker categories={categories ?? []} startedBy={profile.id} familyId={profile.family_id} />
    </div>
  );
}
