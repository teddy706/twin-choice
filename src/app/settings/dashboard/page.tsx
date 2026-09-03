import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/currentProfile";
import { createClient } from "@/lib/supabase/server";
import { computeConcessionStats } from "@/lib/concessionStats";
import { ConcessionChart } from "@/components/ConcessionChart";
import { ObservationReport } from "@/components/ObservationReport";
import { Topbar } from "@/components/Topbar";

// 최소 표본: 이보다 적으면 "아직 데이터가 부족해요"만 보여준다 — 몇 번 안 되는 조율로
// 성급하게 비율을 단정하지 않기 위함(퍼센트가 뻥튀기되어 보이는 걸 방지).
const MIN_SAMPLE = 4;

// 부모 전용 화면. RLS는 resolutions/choices를 자녀도 개별 row 단위로 볼 수 있게 열어뒀지만
// (게임 진행상 "누가 이겼는지"는 자녀도 봐야 함), 이 페이지가 하는 것처럼 "모아서 집계"하는 건
// role='parent' 를 확인하는 서버 컴포넌트에서만 계산한다 — 브라우저가 직접 GROUP BY 하지 않는다.
export default async function DashboardPage() {
  const profile = await requireProfile();
  if (profile.role !== "parent") redirect("/home");

  const supabase = createClient();

  const [{ data: kids }, { data: resolutions }] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar").eq("family_id", profile.family_id).eq("role", "child").order("created_at"),
    supabase
      .from("resolutions")
      .select("id, type, conceded_profile_id, resolved_at, rounds!inner(family_id)")
      .eq("rounds.family_id", profile.family_id),
  ]);

  const childList = kids ?? [];
  const stats = computeConcessionStats(resolutions ?? []);

  const palette = ["#FF6B8A", "#2EC4B6", "#FFB84D", "#8A8A8A"];
  const kidSeries = childList.map((c, i) => ({ ...c, color: palette[i % palette.length] }));

  const notEnoughData = stats.totalConcededRounds < MIN_SAMPLE;

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <Link href="/settings" className="mb-1.5 inline-block text-sm text-soft">← 설정</Link>
      <h2 className="mb-1 text-[19px] font-bold">📊 대시보드</h2>
      <p className="sub mb-4 text-sm text-soft">지금까지 총 {stats.totalResolvedRounds}번 조율했어요</p>

      {notEnoughData ? (
        <div className="card py-10 text-center text-soft">
          아직 데이터가 부족해요.
          <br />
          조율이 {MIN_SAMPLE}번 이상 쌓이면 여기에 보여드릴게요.
        </div>
      ) : (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-3">
            {kidSeries.map((c) => {
              const count = stats.concedeCountByChild[c.id] ?? 0;
              const pct = stats.totalConcededRounds ? Math.round((count / stats.totalConcededRounds) * 100) : 0;
              return (
                <div key={c.id} className="card mb-0" style={{ borderLeft: `4px solid ${c.color}` }}>
                  <div className="mb-1 text-sm font-semibold">{c.avatar} {c.name}</div>
                  <div className="text-2xl font-extrabold">{pct}%</div>
                  <div className="text-xs text-soft">{count}번 양보</div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h3 className="mb-3 font-bold">주간 추이 (최근 8주)</h3>
            <ConcessionChart weekly={stats.weekly} kids={kidSeries} />
          </div>

          <ObservationReport />
        </>
      )}

      <p className="mt-3 text-center text-xs text-soft">
        이 수치는 참고용 기록일 뿐이에요. 아이의 성격을 판단하는 근거로 쓰지 마세요.
      </p>
    </div>
  );
}
