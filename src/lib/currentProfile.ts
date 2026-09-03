import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type ProfileWithAvatar = Profile & { avatarUrl: string | null };

// 서버 컴포넌트/라우트 핸들러에서 "지금 로그인한 사람이 누구인지"를 한 번에 가져온다.
// role 분기는 항상 이 함수가 돌려준 profile.role 을 기준으로 하고,
// 자녀 role일 때는 부모 전용 컴포넌트를 아예 import/렌더링하지 않는 방식으로 통계 노출을 막는다.
//
// avatar_photo_path 가 있으면 서명된 URL을 한 번에 같이 계산해서 붙여준다 — Topbar 처럼
// 거의 모든 페이지가 이 함수로 얻은 profile 을 그대로 쓰기 때문에, 여기서 한 번만 계산해두면
// 페이지마다 따로 서명 URL을 만들 필요가 없다(본인 것만 해당 — 다른 프로필 아바타는
// 그 목록을 조회하는 화면에서 각자 만든다: 예) ChildrenManager, 자녀 로그인 프로필 선택 화면).
export async function getCurrentProfile(): Promise<ProfileWithAvatar | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return null;

  let avatarUrl: string | null = null;
  if (profile.avatar_photo_path) {
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_photo_path, 3600);
    avatarUrl = signed?.signedUrl ?? null;
  }

  return { ...profile, avatarUrl };
}

export async function requireProfile(): Promise<ProfileWithAvatar> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}
