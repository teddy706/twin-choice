import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/webpush";

// 라운드가 시작되거나 공개되는 순간 상대(들)에게 알려준다. 클라이언트가 자기 액션(라운드 생성,
// 또는 자기 제출로 공개가 완성된 순간) 직후에 한 번 호출하는 방식 — DB 트리거가 아니라
// "그 일을 실제로 일으킨 클라이언트"가 알린다(fire-and-forget, 실패해도 게임 진행엔 지장 없음).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("id, family_id, name").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 403 });

  const { roundId, event } = await request.json();
  if (!roundId || (event !== "started" && event !== "revealed")) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, family_id, category_id, started_by")
    .eq("id", roundId)
    .maybeSingle();
  if (!round || round.family_id !== profile.family_id) {
    return NextResponse.json({ error: "라운드를 찾을 수 없어요." }, { status: 404 });
  }

  const { data: category } = await supabase.from("categories").select("name, emoji").eq("id", round.category_id).maybeSingle();
  const catLabel = category ? `${category.emoji} ${category.name}` : "새 라운드";

  let targetProfileIds: string[] = [];
  let title = "";
  let body = "";

  if (event === "started") {
    const { data: siblings } = await supabase
      .from("profiles")
      .select("id")
      .eq("family_id", profile.family_id)
      .eq("role", "child")
      .neq("id", round.started_by ?? "");
    targetProfileIds = (siblings ?? []).map((s) => s.id);
    title = "🎯 새로운 선택이 시작됐어요!";
    body = `${profile.name}가 "${catLabel}" 라운드를 시작했어요`;
  } else {
    const { data: choices } = await supabase.from("choices").select("profile_id").eq("round_id", roundId);
    targetProfileIds = (choices ?? []).map((c) => c.profile_id).filter((id) => id !== profile.id);
    title = "🎉 결과가 공개됐어요!";
    body = `"${catLabel}" 라운드 결과를 확인해보세요`;
  }

  if (targetProfileIds.length === 0) return NextResponse.json({ sent: 0 });

  // 다른 프로필의 구독 정보를 읽어야 하므로(RLS는 본인 것만 SELECT 허용) 여기서만 서비스 롤을 쓴다.
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", targetProfileIds);

  const expiredIds: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (sub) => {
      const result = await sendPush(sub, { title, body, url: `/round/${roundId}` });
      if (result.expired) expiredIds.push(sub.id);
    })
  );

  if (expiredIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expiredIds);
  }

  return NextResponse.json({ sent: (subs?.length ?? 0) - expiredIds.length });
}
