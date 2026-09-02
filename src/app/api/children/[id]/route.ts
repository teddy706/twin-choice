import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 부모가 자녀 데이터를 전체 삭제한다. auth.users 행을 지우면 profiles.user_id 의
// on delete cascade 로 profile row 가 함께 지워지고, 거기서 다시 choices/photos(cascade),
// rounds.started_by/resolutions/turn_state(set null) 로 이어진다.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("family_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myProfile || myProfile.role !== "parent") {
    return NextResponse.json({ error: "부모만 할 수 있어요." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: child } = await admin
    .from("profiles")
    .select("id, user_id, family_id, role")
    .eq("id", params.id)
    .maybeSingle();

  if (!child || child.family_id !== myProfile.family_id || child.role !== "child") {
    return NextResponse.json({ error: "자녀 프로필을 찾을 수 없어요." }, { status: 404 });
  }

  if (child.user_id) {
    await admin.auth.admin.deleteUser(child.user_id);
  } else {
    await admin.from("profiles").delete().eq("id", child.id);
  }

  return NextResponse.json({ ok: true });
}
