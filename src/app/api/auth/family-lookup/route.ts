import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 자녀는 이메일이 없어 로그인 전에는 auth.uid() 가 없다 -> RLS를 아직 쓸 수 없다.
// 가족 코드로 family 를 특정한 뒤, 이름/아바타처럼 민감하지 않은 정보만 admin 클라이언트로 돌려준다.
// PIN, pin_hash 등은 절대 이 응답에 포함하지 않는다.
export async function POST(request: Request) {
  const { joinCode } = await request.json();
  if (!joinCode || typeof joinCode !== "string") {
    return NextResponse.json({ error: "가족 코드를 입력해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: family } = await admin
    .from("families")
    .select("id, name, join_code")
    .eq("join_code", joinCode.trim().toUpperCase())
    .maybeSingle();

  if (!family) {
    return NextResponse.json({ error: "가족 코드를 찾을 수 없어요." }, { status: 404 });
  }

  const { data: children } = await admin
    .from("profiles")
    .select("id, name, avatar")
    .eq("family_id", family.id)
    .eq("role", "child")
    .order("created_at", { ascending: true });

  return NextResponse.json({
    familyId: family.id,
    familyName: family.name,
    joinCode: family.join_code,
    children: children ?? [],
  });
}
