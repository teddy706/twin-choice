import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// 서버 컴포넌트/라우트 핸들러에서 "지금 로그인한 사람이 누구인지"를 한 번에 가져온다.
// role 분기는 항상 이 함수가 돌려준 profile.role 을 기준으로 하고,
// 자녀 role일 때는 부모 전용 컴포넌트를 아예 import/렌더링하지 않는 방식으로 통계 노출을 막는다.
export async function getCurrentProfile(): Promise<Profile | null> {
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

  return profile;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}
