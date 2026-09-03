import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { PhotoArchive } from "@/components/PhotoArchive";
import { Topbar } from "@/components/Topbar";

export default async function PhotosSettingsPage() {
  const profile = await requireProfile();
  // 사진 아카이브는 부모 전용 — 자녀는 화면 자체가 없는 것처럼 홈으로 돌려보낸다.
  if (profile.role !== "parent") redirect("/home");

  const supabase = createClient();

  // RLS(photos_select)가 블라인드를 지킨다: 본인 사진 아니면 라운드가 공개된 뒤에만 보인다.
  const [{ data: photos }, { data: profiles }, { data: categories }] = await Promise.all([
    supabase
      .from("photos")
      .select("id, profile_id, storage_path, ai_category, ai_label, confirmed, created_at")
      .eq("family_id", profile.family_id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name, avatar").eq("family_id", profile.family_id),
    supabase.from("categories").select("name, emoji").eq("family_id", profile.family_id),
  ]);

  const photoUrls: Record<string, string> = {};
  if (photos && photos.length > 0) {
    await Promise.all(
      photos.map(async (p) => {
        const { data: signed } = await supabase.storage.from("photos").createSignedUrl(p.storage_path, 3600);
        if (signed) photoUrls[p.id] = signed.signedUrl;
      })
    );
  }

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <Link href="/settings" className="mb-1.5 inline-block text-sm text-soft">← 설정</Link>
      <h2 className="mb-3.5 text-[19px] font-bold">🖼️ 사진 아카이브</h2>
      <PhotoArchive
        initialPhotos={photos ?? []}
        profiles={profiles ?? []}
        categories={categories ?? []}
        photoUrls={photoUrls}
      />
    </div>
  );
}
