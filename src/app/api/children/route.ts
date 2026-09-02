import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { childProfileEmail, deriveChildAuthPassword, hashPinForDisplay, isValidPin } from "@/lib/childAuth";

async function requireParent() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요해요.", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "parent") {
    return { error: "부모만 할 수 있어요.", status: 403 as const };
  }
  return { profile };
}

// 자녀 프로필 생성: family/profile 프로비저닝이므로 admin(service role) 클라이언트가 실제 쓰기를 수행한다.
// 호출자가 진짜 그 family 의 parent 인지는 위 requireParent() 에서 사용자 세션으로 먼저 검증한다.
export async function POST(request: Request) {
  const auth = await requireParent();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, avatar, pin } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  if (!isValidPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "PIN은 4자리 숫자여야 해요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const profileId = randomUUID();
  const email = childProfileEmail(profileId);
  const password = deriveChildAuthPassword(profileId, String(pin));

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "child", profile_id: profileId },
  });

  if (userError || !userData.user) {
    return NextResponse.json({ error: "자녀 계정을 만들지 못했어요." }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      id: profileId,
      family_id: auth.profile.family_id,
      user_id: userData.user.id,
      role: "child",
      name: name.trim(),
      avatar: avatar || "🧒",
      pin_hash: await hashPinForDisplay(String(pin)),
    })
    .select("id, name, avatar")
    .single();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(userData.user.id);
    return NextResponse.json({ error: "자녀 프로필을 만들지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, child: profile });
}
