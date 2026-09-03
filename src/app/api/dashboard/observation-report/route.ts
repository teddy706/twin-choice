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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const summary = await generateObservationSummary({
    windowLabel: WINDOW_LABEL,
    totalConceded: recentTotal,
    children: childStats,
  });

  if (!summary || containsBannedLanguage(summary)) {
    return NextResponse.json({ available: false, blocked: true });
  }

  return NextResponse.json({ available: true, summary });
}
