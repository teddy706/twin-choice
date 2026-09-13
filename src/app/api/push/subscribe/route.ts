import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  // middleware.ts가 이미 getUser()로 세션을 검증/갱신했으므로 여기서는 로컬 getSession()으로 읽는다.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("id, family_id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 403 });

  const { endpoint, keys } = await request.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "구독 정보가 올바르지 않아요." }, { status: 400 });
  }

  // 같은 기기를 형제가 돌려쓰면 endpoint 가 같을 수 있다 — upsert로 "지금 이 기기를 쓰는 사람"에게
  // 소유권을 넘긴다(0009_push_notifications.sql 의 update 정책이 이 재할당을 허용한다).
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      family_id: profile.family_id,
      profile_id: profile.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: "구독을 저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
