import "server-only";

// "양보 지수" 집계 — RLS는 행 단위라 resolutions/choices 개별 row는 자녀도 볼 수 있다
// (게임 진행상 "누가 이겼는지"는 자녀도 봐야 하므로). 그래서 이 집계는 반드시
// role='parent' 를 확인하는 서버 코드(이 파일을 부르는 서버 컴포넌트/라우트)에서만 계산하고,
// 브라우저가 직접 GROUP BY 하지 않는다.

export interface ResolutionRow {
  id: string;
  type: string;
  conceded_profile_id: string | null;
  resolved_at: string;
}

export interface WeekBucket {
  weekStart: string; // YYYY-MM-DD
  countByChild: Record<string, number>;
}

export interface ConcessionStats {
  totalResolvedRounds: number;
  totalConcededRounds: number; // conceded_profile_id 가 있는 라운드만(일치/둘다 하기는 제외)
  concedeCountByChild: Record<string, number>;
  weekly: WeekBucket[]; // 최근 8주, 오래된 순
}

function weekStartUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0=일 ... 6=토
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeConcessionStats(resolutions: ResolutionRow[], weeks = 8): ConcessionStats {
  const conceded = resolutions.filter((r) => r.conceded_profile_id);

  const concedeCountByChild: Record<string, number> = {};
  for (const r of conceded) {
    const id = r.conceded_profile_id!;
    concedeCountByChild[id] = (concedeCountByChild[id] ?? 0) + 1;
  }

  const thisWeekStart = weekStartUTC(new Date());
  const bucketStarts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    bucketStarts.push(new Date(thisWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000));
  }

  const weekly: WeekBucket[] = bucketStarts.map((start) => ({
    weekStart: toDateKey(start),
    countByChild: {},
  }));

  for (const r of conceded) {
    const resolvedAt = new Date(r.resolved_at);
    const bucketIndex = bucketStarts.findIndex((start, i) => {
      const next = i + 1 < bucketStarts.length ? bucketStarts[i + 1] : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      return resolvedAt >= start && resolvedAt < next;
    });
    if (bucketIndex === -1) continue; // 8주보다 오래된 기록은 추이 그래프에서 제외
    const bucket = weekly[bucketIndex];
    const id = r.conceded_profile_id!;
    bucket.countByChild[id] = (bucket.countByChild[id] ?? 0) + 1;
  }

  return {
    totalResolvedRounds: resolutions.length,
    totalConcededRounds: conceded.length,
    concedeCountByChild,
    weekly,
  };
}
