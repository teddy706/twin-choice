import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeConcessionStats } from "@/lib/concessionStats";
import { generateStartPrioritySuggestion } from "@/lib/azureOpenAI";
import { containsBannedLanguage } from "@/lib/observationSafety";

// 최근 2주 동안 조율이 이만큼은 있어야 제안을 만든다(observation-report와 동일한 최소 표본 원칙).
const MIN_RECENT_SAMPLE = 4;
const RECENT_WEEKS = 2;
const WINDOW_LABEL = "최근 2주";

// "이번엔 누구에게" 우선권 제안. observation-report와 달리 부모 전용이 아니다 —
// 기록 화면 자체가 부모/자녀 공용이라 이 라우트도 가족 구성원이면 역할 상관없이 호출 가능하다
// (이 결정은 CLAUDE.md의 "양보 지수 자녀 노출 금지" 원칙과 다르지만, 사용자가 명시적으로
// 선택한 방향이다). 다만 로그인은 필요하고, 항상 부모가 버튼을 눌렀을 때만 호출된다(원칙 7).
export async function POST() {
  const supabase = createClient();
  // middleware.ts가 이미 getUser()로 세션을 검증/갱신했으므로 여기서는 로컬 getSession()으로 읽는다.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 404 });

  const [{ data: kids }, { data: resolutions }] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("family_id", profile.family_id).eq("role", "child").order("created_at"),
    supabase
      .from("resolutions")
      .select("id, type, conceded_profile_id, resolved_at, rounds!inner(family_id)")
      .eq("rounds.family_id", profile.family_id),
  ]);

  const childList = kids ?? [];
  if (childList.length !== 2) {
    // 이 제안은 "둘 중 누구" 형태라 자녀가 정확히 2명일 때만 의미가 있다.
    return NextResponse.json({ available: false });
  }

  const stats = computeConcessionStats(resolutions ?? [], 8);
  const recentBuckets = stats.weekly.slice(-RECENT_WEEKS);

  const recentCountByChild: Record<string, number> = {};
  let recentTotal = 0;
  for (const bucket of recentBuckets) {
    for (const [childId, count] of Object.entries(bucket.countByChild)) {
      recentCountByChild[childId] = (recentCountByChild[childId] ?? 0) + count;
      recentTotal += count;
    }
  }

  if (recentTotal < MIN_RECENT_SAMPLE) {
    return NextResponse.json({ available: false });
  }

  const [a, b] = childList.map((c) => ({ name: c.name, concedeCount: recentCountByChild[c.id] ?? 0 }));
  const suggestedChildName = a.concedeCount === b.concedeCount ? null : a.concedeCount > b.concedeCount ? a.name : b.name;

  const suggestion = await generateStartPrioritySuggestion({
    windowLabel: WINDOW_LABEL,
    suggestedChildName,
    children: [a, b],
  });

  if (!suggestion || containsBannedLanguage(suggestion)) {
    return NextResponse.json({ available: false, blocked: true });
  }

  return NextResponse.json({ available: true, suggestion });
}
