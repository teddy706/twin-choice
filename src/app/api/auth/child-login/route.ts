import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { childProfileEmail, deriveChildAuthPassword, isValidPin } from "@/lib/childAuth";

export async function POST(request: Request) {
  const { familyId, profileId, pin } = await request.json();

  if (!familyId || !profileId || !isValidPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "PIN 4자리를 입력해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  // profileId 가 실제로 그 family 의 child 프로필인지 서버에서 재확인한다(클라이언트 값 신뢰 금지).
  const { data: profile } = await admin
    .from("profiles")
    .select("id, family_id, role")
    .eq("id", profileId)
    .eq("family_id", familyId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 404 });
  }

  const email = childProfileEmail(profile.id);
  const password = deriveChildAuthPassword(profile.id, String(pin));

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
