"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startPcmRecording, type PcmRecorder } from "@/lib/pcmRecorder";
import { MicIcon } from "@/components/icons";

type State =
  | { kind: "idle" }
  | { kind: "recording"; seconds: number }
  | { kind: "transcribing" }
  | { kind: "confirm"; text: string }
  | { kind: "saved"; text: string }
  | { kind: "error"; message: string };

const MAX_SECONDS = 15;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("변환 실패"));
    reader.readAsDataURL(blob);
  });
}

// "왜 이게 좋아?" 를 목소리로 남기는 선택적 단계. 자녀가 자기 선택을 낸 뒤 상대방을 기다리는
// 동안(RoundView의 대기 화면) 보여준다 — 탭 즉시 반응이라는 기존 원칙을 안 건드리고 어차피
// 비어있는 대기 시간을 활용한다. 목소리 자체는 저장하지 않고, 변환된 텍스트만 자녀가 직접
// 확인(코딩 시 주의사항 6번과 동일 원칙)한 뒤 저장한다. 완전히 건너뛸 수 있다.
export function VoiceReasonRecorder({
  roundId,
  choiceId,
  initialReason,
}: {
  roundId: string;
  choiceId: string;
  initialReason: string | null;
}) {
  const [state, setState] = useState<State>(initialReason ? { kind: "saved", text: initialReason } : { kind: "idle" });
  const pcmRecorderRef = useRef<PcmRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // 브라우저 기본 MediaRecorder(webm/opus)는 Azure AI Speech 단문 인식 API가 거부한다 —
      // 16kHz mono WAV로 직접 인코딩하는 pcmRecorder를 쓴다(src/lib/pcmRecorder.ts 주석 참고).
      pcmRecorderRef.current = startPcmRecording(stream);
      setState({ kind: "recording", seconds: 0 });

      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setState((prev) => (prev.kind === "recording" ? { kind: "recording", seconds: elapsed } : prev));
        if (elapsed >= MAX_SECONDS) stopRecording();
      }, 1000);
    } catch {
      setState({ kind: "error", message: "마이크를 쓸 수 없어요. 설정에서 허용해주세요." });
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const recorder = pcmRecorderRef.current;
    if (!recorder) return;
    void handleRecordingStopped(recorder.stop());
  }

  async function handleRecordingStopped(blob: Blob) {
    setState({ kind: "transcribing" });
    if (blob.size === 0) {
      setState({ kind: "error", message: "녹음이 안 됐어요. 다시 해볼래?" });
      return;
    }
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch(`/api/rounds/${roundId}/transcribe-reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mediaType: "audio/wav" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "변환하지 못했어요." });
        return;
      }
      setState({ kind: "confirm", text: data.text });
    } catch {
      setState({ kind: "error", message: "네트워크가 불안정해서 실패했어요." });
    }
  }

  async function save(text: string) {
    const supabase = createClient();
    const { error } = await supabase.from("choices").update({ reason: text }).eq("id", choiceId);
    if (error) {
      setState({ kind: "error", message: "저장하지 못했어요." });
      return;
    }
    setState({ kind: "saved", text });
  }

  return (
    <div className="card">
      <h3 className="mb-1 flex items-center gap-2 font-bold">
        <MicIcon size={18} /> 왜 이게 좋아? (선택)
      </h3>
      <p className="mb-3 text-xs text-soft">네 목소리는 저장 안 하고, 글자로만 바꿔서 저장해요.</p>

      {state.kind === "idle" && (
        <button className="btn btn-outline mb-0" onClick={startRecording}>
          🎙 목소리로 말하기
        </button>
      )}

      {state.kind === "recording" && (
        <div className="text-center">
          <div className="mx-auto mb-3 h-4 w-4 animate-pulse rounded-full bg-red-500" />
          <p className="mb-3 text-sm font-semibold text-soft">{state.seconds}초 / {MAX_SECONDS}초</p>
          <button className="btn btn-outline mb-0" onClick={stopRecording}>
            그만 말할래요
          </button>
        </div>
      )}

      {state.kind === "transcribing" && (
        <div className="flex items-center gap-2 text-sm font-semibold text-soft">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          듣는 중...
        </div>
      )}

      {state.kind === "confirm" && (
        <div>
          <p className="mb-3 rounded-2xl border-2 border-ink bg-white p-4 text-sm font-semibold leading-relaxed">
            &ldquo;{state.text}&rdquo;
          </p>
          <button className="btn btn-primary" onClick={() => save(state.text)}>
            저장하기
          </button>
          <button className="btn btn-outline mb-0" onClick={startRecording}>
            다시 녹음하기
          </button>
        </div>
      )}

      {state.kind === "saved" && (
        <div>
          <p className="mb-3 rounded-2xl border-2 border-ink bg-white p-4 text-sm font-semibold leading-relaxed">
            &ldquo;{state.text}&rdquo;
          </p>
          <button className="btn btn-ghost mb-0 border-2 border-ink" onClick={startRecording}>
            다시 녹음하기
          </button>
        </div>
      )}

      {state.kind === "error" && (
        <div>
          <p className="mb-3 text-sm text-soft">{state.message}</p>
          <button className="btn btn-outline mb-0" onClick={() => setState({ kind: "idle" })}>
            다시 시도하기
          </button>
        </div>
      )}
    </div>
  );
}
