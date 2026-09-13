import type { WeekBucket } from "@/lib/concessionStats";

type ChildSeries = { id: string; name: string; avatar: string; color: string };

// 주간 양보 횟수 그룹 막대 그래프. 서버에서 정적으로 렌더링(호버 없음) —
// 막대마다 항상 숫자 라벨이 보여서 이 규모(8주 x 2명)에선 호버가 딱히 필요 없다고 판단.
// 카테고리컬 색상은 앱 기존 토큰(a=코랄/b=틸)을 그대로 쓴다 — CVD 대비가 floor 구간이라
// 색상만으로 구분하지 않고 항상 범례+직접 라벨(숫자)을 같이 보여준다(dataviz 스킬 권고).
export function ConcessionChart({ weekly, kids }: { weekly: WeekBucket[]; kids: ChildSeries[] }) {
  const plotW = 600;
  const plotH = 160;
  const padLeft = 8;
  const padBottom = 26;
  const groupGap = 10;
  const barGap = 2;

  const maxCount = Math.max(1, ...weekly.map((w) => Math.max(0, ...kids.map((c) => w.countByChild[c.id] ?? 0))));
  const groupWidth = (plotW - padLeft * 2 - groupGap * (weekly.length - 1)) / weekly.length;
  const barWidth = (groupWidth - barGap * (kids.length - 1)) / kids.length;

  function barPath(x: number, w: number, h: number, baseline: number) {
    const r = Math.min(4, h / 2);
    if (h <= 0) return "";
    const yTop = baseline - h;
    return `M${x},${baseline} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + w - r},${yTop} Q${x + w},${yTop} ${x + w},${yTop + r} L${x + w},${baseline} Z`;
  }

  const baseline = plotH;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        {kids.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.avatar} {c.name}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${plotW} ${plotH + padBottom}`} width="100%" style={{ minWidth: 480 }}>
          <line x1={0} y1={baseline} x2={plotW} y2={baseline} stroke="#F0E9DD" strokeWidth={1} />
          {weekly.map((w, gi) => {
            const gx = padLeft + gi * (groupWidth + groupGap);
            const d = new Date(w.weekStart);
            const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            return (
              <g key={w.weekStart}>
                {kids.map((c, ci) => {
                  const count = w.countByChild[c.id] ?? 0;
                  const h = (count / maxCount) * (plotH - 20);
                  const bx = gx + ci * (barWidth + barGap);
                  return (
                    <g key={c.id}>
                      {count > 0 && <path d={barPath(bx, barWidth, h, baseline)} fill={c.color} />}
                      {count > 0 && (
                        <text
                          x={bx + barWidth / 2}
                          y={baseline - h - 4}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={700}
                          fill="#3A3A3A"
                        >
                          {count}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text x={gx + groupWidth / 2} y={baseline + 16} textAnchor="middle" fontSize={9} fill="#8A8A8A">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
