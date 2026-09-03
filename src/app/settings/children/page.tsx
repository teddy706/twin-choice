import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { ChildrenManager } from "@/components/ChildrenManager";
import { Topbar } from "@/components/Topbar";

export default async function ChildrenSettingsPage() {
  const profile = await requireProfile();
  // 자녀 role이면 이 화면 자체가 존재하지 않는 것처럼 홈으로 돌려보낸다(자녀 관리는 부모 전용).
  if (profile.role !== "parent") redirect("/home");

  const supabase = createClient();
  const { data: family } = await supabase.from("families").select("join_code, name").eq("id", profile.family_id).maybeSingle();
  const { data: children } = await supabase
    .from("profiles")
    .select("id, name, avatar, created_at")
    .eq("family_id", profile.family_id)
    .eq("role", "child")
    .order("created_at");

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <Link href="/settings" className="mb-1.5 inline-block text-sm text-soft">← 설정</Link>
      <h2 className="mb-3.5 text-[19px] font-bold">🧒 자녀 관리</h2>
      <ChildrenManager joinCode={family?.join_code ?? ""} initialChildren={children ?? []} />
    </div>
  );
}
