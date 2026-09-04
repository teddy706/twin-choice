"use client";

import { useState } from "react";
import { TurnIcon } from "@/components/icons";

type SuggestionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; suggestion: string }
  | { kind: "error" };

// "이번엔 누구에게 먼저 고를 기회를 주면 좋을지" AI 제안. 기록 화면(부모/자녀 공용)에 마운트된다 —
// 이건 CLAUDE.md의 "양보 지수 자녀 노출 금지" 원칙과 다른, 사용자가 명시적으로 선택한 방향이다.
// 그래도 안전장치는 최대한 유지한다: 버튼을 눌러야만 호출(자동 실행 금지), 디스클레이머 항상 표시,
// 최소 표본 미만이면 API가 available:false만 반환(AI 호출 자체를 안 함).
export function PrioritySuggestion() {
  const [state, setState] = useState<SuggestionState>({ kind: "idle" });

  async function loadSuggestion() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/history/priority-suggestion", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      if (!data.available) {
        setState({ kind: "unavailable" });
        return;
      }
      setState({ kind: "ready", suggestion: data.suggestion });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className="mb-3.5 rounded-card border-2 border-ink bg-sage p-5">
      <h3 className="mb-1.5 flex items-center gap-2 font-extrabold">
        <TurnIcon size={20} /> 이번엔 누구 차례?
      </h3>
      <p className="mb-3 text-xs font-semibold text-ink/60">
        그냥 참고용 제안이에요. 꼭 이대로 안 해도 괜찮아요!
      </p>

      {state.kind === "idle" && (
        <button className="btn btn-outline mb-0" onClick={loadSuggestion}>
          제안 보기
        </button>
      )}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm font-semibold text-ink/60">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          생각하는 중...
        </div>
      )}

      {state.kind === "ready" && (
        <p className="rounded-2xl border-2 border-ink bg-white p-4 text-sm font-semibold leading-relaxed">{state.suggestion}</p>
      )}

      {state.kind === "unavailable" && (
        <p className="text-sm text-soft">아직 기록이 조금 부족해요. 조금 더 쌓이면 다시 확인해보세요.</p>
      )}

      {state.kind === "error" && (
        <p className="text-sm text-soft">지금은 제안을 만들지 못했어요. 잠시 후 다시 시도해주세요.</p>
      )}
    </div>
  );
}
