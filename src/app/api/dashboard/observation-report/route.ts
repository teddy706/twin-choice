import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeConcessionStats } from "@/lib/concessionStats";
import { generateObservationSummary } from "@/lib/azureOpenAI";
import { containsBannedLanguage } from "@/lib/observationSafety";

// 최근 2주 동안 조율이 이만큼은 있어야 리포트를 만든다(원칙 4: 최소 표본 미만이면 생성 자체를 안 함).
const MIN_RECENT_SAMPLE = 4;
const RECENT_WEEKS = 2;
const WINDOW_LABEL = "최근 2주";

// Phase 2 "AI 패턴 관찰 리포트". 부모가 명시적으로 버튼을 눌렀을 때만 호출된다(원칙 7).
// role='parent' 는 여기서 다시 한 번 서버가 확인한다(원칙 3과 대시보드 집계 원칙의 연장 —
// 클라이언트 role 값을 신뢰하지 않는다).
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
    .select("id, family_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "parent") {
    return NextResponse.json({ error: "부모만 볼 수 있어요." }, { status: 403 });
  }

  const [{ data: kids }, { data: resolutions }] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("family_id", profile.family_id).eq("role", "child").order("created_at"),
    supabase
      .from("resolutions")
      .select("id, type, conceded_profile_id, resolved_at, rounds!inner(family_id)")
      .eq("rounds.family_id", profile.family_id),
  ]);

  const childList = kids ?? [];
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

  const childStats = childList.map((c) => {
    const count = recentCountByChild[c.id] ?? 0;
    return { name: c.name, concedeCount: count, concedeRatePct: Math.round((count / recentTotal) * 100) };
  });

  let summary: string;
  try {
    summary = await generateObservationSummary({
      windowLabel: WINDOW_LABEL,
      totalConceded: recentTotal,
      children: childStats,
    });
  } catch (err) {
    // 데이터가 부족한 것과 AI 호출 자체가 실패한 건 다른 상황이라 구분해서 알려준다 —
    // 둘 다 available:false로 뭉치면 "데이터가 부족해요"라는 잘못된 안내가 뜬다(데이터는
    // 충분한데 AI가 잠깐 안 됐을 뿐이므로). 클라이언트는 res.ok가 아니면 별도 에러 문구를 보여준다.
    console.error("generateObservationSummary failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "지금은 요약을 만들지 못했어요." }, { status: 502 });
  }

  if (!summary || containsBannedLanguage(summary)) {
    return NextResponse.json({ available: false, blocked: true });
  }

  return NextResponse.json({ available: true, summary });
}
