"use client";

import { useState } from "react";
import { MagnifierIcon } from "@/components/icons";

type ReportState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; summary: string }
  | { kind: "error" };

// Phase 2 "AI 패턴 관찰 리포트". 절대 원칙: (1) 부모가 버튼을 눌러야만 호출(자동 실행 금지),
// (2) 디스클레이머를 항상 같이 보여준다(요약 유무와 무관하게 하드코딩), (3) 이 컴포넌트 자체가
// /settings/dashboard(부모 전용 라우트)에서만 마운트된다 — 자녀 role 트리에는 애초에 존재하지 않음.
export function ObservationReport() {
  const [state, setState] = useState<ReportState>({ kind: "idle" });

  async function loadReport() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/dashboard/observation-report", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      if (!data.available) {
        setState({ kind: "unavailable" });
        return;
      }
      setState({ kind: "ready", summary: data.summary });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className="mb-3.5 rounded-card border-2 border-ink bg-lilac p-5">
      <h3 className="mb-1.5 flex items-center gap-2 font-extrabold">
        <MagnifierIcon size={20} /> AI 관찰 요약
      </h3>
      <p className="mb-3 text-xs font-semibold text-ink/60">
        이건 심리 평가가 아니에요. 계속 마음에 걸리는 부분이 있다면 전문가와 상담해보세요.
      </p>

      {state.kind === "idle" && (
        <button className="btn btn-outline mb-0" onClick={loadReport}>
          최근 2주 요약 보기
        </button>
      )}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm font-semibold text-ink/60">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          AI가 정리하는 중...
        </div>
      )}

      {state.kind === "ready" && (
        <p className="rounded-2xl border-2 border-ink bg-white p-4 text-sm font-semibold leading-relaxed">{state.summary}</p>
      )}

      {state.kind === "unavailable" && (
        <p className="text-sm text-soft">최근 2주 동안은 아직 데이터가 부족해요. 조금 더 쌓이면 다시 확인해보세요.</p>
      )}

      {state.kind === "error" && (
        <p className="text-sm text-soft">지금은 요약을 만들지 못했어요. 잠시 후 다시 시도해주세요.</p>
      )}
    </div>
  );
}
