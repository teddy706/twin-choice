import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { endpoint } = await request.json();
  if (!endpoint) return NextResponse.json({ error: "구독 정보가 없어요." }, { status: 400 });

  // RLS(profile_id = my_profile_id())가 스코프를 강제한다 — 이미 다른 형제가 이 기기를
  // 이어받았다면(row의 profile_id가 더 이상 내가 아님) 지울 게 없을 뿐이라 에러여도 무해하다.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
