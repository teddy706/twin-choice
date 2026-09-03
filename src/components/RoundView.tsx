"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resizeImageForUpload } from "@/lib/imageResize";
import type { Choice, Item, Profile, Resolution, Round, Category } from "@/lib/types";

type FamilyProfile = Pick<Profile, "id" | "name" | "avatar" | "role">;
type RoundRow = Pick<Round, "id" | "family_id" | "category_id" | "status" | "expected_participants" | "started_by">;
type ItemOption = Pick<Item, "id" | "name" | "emoji">;
type CategoryInfo = Pick<Category, "id" | "name" | "emoji"> | null;
type ChoiceRow = Pick<Choice, "id" | "profile_id" | "item_id" | "submitted_at">;

export function RoundView({
  profile,
  round,
  category,
  items,
  familyProfiles,
  initialChoices,
  initialResolution,
}: {
  profile: Profile;
  round: RoundRow;
  category: CategoryInfo;
  items: ItemOption[];
  familyProfiles: FamilyProfile[];
  initialChoices: ChoiceRow[];
  initialResolution: Resolution | null;
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<ChoiceRow[]>(initialChoices);
  const [resolution, setResolution] = useState<Resolution | null>(initialResolution);
  const [submitting, setSubmitting] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "사진으로 고르기" 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickMode, setPickMode] = useState<"grid" | "camera">("grid");
  const [photoStatus, setPhotoStatus] = useState<"idle" | "analyzing" | "confirm" | "unmatched">("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ itemId: string | null; label: string; storagePath: string } | null>(
    null
  );

  const profileById = useMemo(() => new Map(familyProfiles.map((p) => [p.id, p])), [familyProfiles]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Supabase Realtime(postgres_changes) 구독 + 3초 폴링 폴백.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`round-${round.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "choices", filter: `round_id=eq.${round.id}` },
        (payload) => {
          const row = payload.new as ChoiceRow;
          setChoices((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "resolutions", filter: `round_id=eq.${round.id}` },
        (payload) => {
          setResolution(payload.new as Resolution);
        }
      )
      .subscribe();

    const poll = setInterval(async () => {
      const { data: freshChoices } = await supabase
        .from("choices")
        .select("id, profile_id, item_id, submitted_at")
        .eq("round_id", round.id);
      if (freshChoices) setChoices(freshChoices);

      const { data: freshResolution } = await supabase
        .from("resolutions")
        .select("*")
        .eq("round_id", round.id)
        .maybeSingle();
      setResolution(freshResolution ?? null);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [round.id]);

  const myChoice = choices.find((c) => c.profile_id === profile.id) ?? null;
  const otherChoices = choices.filter((c) => c.profile_id !== profile.id);
  const revealed = choices.length >= round.expected_participants;
  const matched = revealed && choices.length === 2 && choices[0].item_id === choices[1].item_id;
  const participantIds = choices.map((c) => c.profile_id);

  async function submitChoice(itemId: string) {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("choices")
      .insert({ round_id: round.id, profile_id: profile.id, item_id: itemId })
      .select("id, profile_id, item_id, submitted_at")
      .single();
    if (insertError || !data) {
      setError("선택을 저장하지 못했어요.");
      setSubmitting(false);
      return;
    }
    setChoices((prev) => [...prev, data]);
    setSubmitting(false);
  }

  async function handlePhotoFile(file: File) {
    setPhotoError(null);
    setPhotoStatus("analyzing");

    // 폰 카메라 원본(수 MB)을 그대로 보내면 서버 요청 크기 제한에 걸리거나 너무 느려지므로
    // 업로드 전에 축소+재압축한다(입력 포맷과 무관하게 image/jpeg 로 정규화됨).
    let resized;
    try {
      resized = await resizeImageForUpload(file);
    } catch {
      setPhotoError("이 사진은 처리할 수 없어요. 다시 찍어줄래?");
      setPhotoStatus("idle");
      return;
    }

    setCapturedPreview(resized.dataUrl);
    const base64 = resized.dataUrl.split(",")[1];

    try {
      const res = await fetch(`/api/rounds/${round.id}/classify-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: resized.mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data.error ?? "사진을 분석하지 못했어요.");
        setPhotoStatus("idle");
        return;
      }
      setAiSuggestion({ itemId: data.matchedItemId, label: data.label, storagePath: data.storagePath });
      setPhotoStatus(data.matchedItemId ? "confirm" : "unmatched");
    } catch {
      setPhotoError("네트워크가 불안정해서 실패했어요. 다시 시도해줄래?");
      setPhotoStatus("idle");
    }
  }

  async function confirmAiChoice() {
    if (!aiSuggestion?.itemId) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("choices")
      .insert({ round_id: round.id, profile_id: profile.id, item_id: aiSuggestion.itemId })
      .select("id, profile_id, item_id, submitted_at")
      .single();
    if (insertError || !data) {
      setError("선택을 저장하지 못했어요.");
      setSubmitting(false);
      return;
    }
    // AI 매칭 결과 확인 성공 시에만 photos row 를 남긴다(거절/재촬영한 사진은 기록하지 않음).
    await supabase.from("photos").insert({
      family_id: round.family_id,
      profile_id: profile.id,
      round_id: round.id,
      item_id: aiSuggestion.itemId,
      storage_path: aiSuggestion.storagePath,
      ai_category: category?.name ?? null,
      ai_label: aiSuggestion.label,
      confirmed: true,
    });
    setChoices((prev) => [...prev, data]);
    setSubmitting(false);
  }

  function retakePhoto() {
    setAiSuggestion(null);
    setCapturedPreview(null);
    setPhotoStatus("idle");
    fileInputRef.current?.click();
  }

  function switchPickMode(mode: "grid" | "camera") {
    setPickMode(mode);
    setAiSuggestion(null);
    setCapturedPreview(null);
    setPhotoStatus("idle");
    setPhotoError(null);
  }

  async function insertResolution(payload: Pick<Resolution, "type" | "winner_profile_id" | "conceded_profile_id">) {
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("resolutions")
      .insert({ round_id: round.id, ...payload })
      .select("*")
      .single();
    if (insertError || !data) {
      setError("결과를 저장하지 못했어요.");
      return;
    }
    setResolution(data);
  }

  async function confirmMatch() {
    await insertResolution({ type: "match", winner_profile_id: null, conceded_profile_id: null });
  }

  async function resolveBoth() {
    await insertResolution({ type: "both", winner_profile_id: null, conceded_profile_id: null });
  }

  async function resolveManual(winnerId: string) {
    const concededId = participantIds.find((id) => id !== winnerId) ?? null;
    await insertResolution({ type: "manual", winner_profile_id: winnerId, conceded_profile_id: concededId });
  }

  async function resolveTurn() {
    const supabase = createClient();
    const { data: turn } = await supabase
      .from("turn_state")
      .select("last_winner_profile_id")
      .eq("family_id", round.family_id)
      .eq("category_id", round.category_id)
      .maybeSingle();

    const lastWinner = turn?.last_winner_profile_id ?? null;
    const winner = !lastWinner ? profile.id : participantIds.find((id) => id !== lastWinner) ?? profile.id;
    const conceded = participantIds.find((id) => id !== winner) ?? null;

    await supabase
      .from("turn_state")
      .upsert({ family_id: round.family_id, category_id: round.category_id, last_winner_profile_id: winner });

    await insertResolution({ type: "turn", winner_profile_id: winner, conceded_profile_id: conceded });
  }

  function spinRoulette() {
    if (spinning || participantIds.length === 0) return;
    setSpinning(true);
    const winner = participantIds[Math.floor(Math.random() * participantIds.length)];
    const conceded = participantIds.find((id) => id !== winner) ?? null;
    setTimeout(async () => {
      await insertResolution({ type: "roulette", winner_profile_id: winner, conceded_profile_id: conceded });
      setSpinning(false);
    }, 1800);
  }

  const catLabel = category ? `${category.emoji} ${category.name}` : "";

  // 부모는 블라인드 선택 자체에 참여하지 않는다(RLS도 choices insert 를 child role로 제한한다).
  // 라운드가 공개되기 전까지는 관전 화면만 보여준다.
  if (profile.role !== "child" && !revealed) {
    return (
      <div className="app-shell items-center justify-center">
        <div className="card center text-center">
          <h2 className="mb-2 text-[19px] font-bold">{catLabel}</h2>
          <div className="spinner mx-auto my-6 h-11 w-11 animate-spin rounded-full border-[5px] border-[#f0f0f0] border-t-accent" />
          <p className="text-sm text-soft">
            {choices.length}/{round.expected_participants}명이 골랐어요. 둘 다 고를 때까지 기다려주세요 👀
          </p>
        </div>
        <Link href="/home" className="btn btn-ghost text-center">홈으로</Link>
      </div>
    );
  }

  // ---- 1. 아직 내 선택을 안 냈다면: 블라인드 선택 화면 ----
  // 부모는 블라인드 선택에 참여하지 않으므로(위 관전 화면 참고) 이 분기는 자녀 role에서만 탄다.
  if (profile.role === "child" && !myChoice) {
    return (
      <div className="app-shell">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhotoFile(file);
            e.target.value = "";
          }}
        />

        <h2 className="mb-1 text-[19px] font-bold">{catLabel} — 좋아하는 걸 골라봐!</h2>
        <p className="sub mb-4 -mt-1 text-sm text-soft">상대방은 네가 뭘 골랐는지 아직 못 봐요 🤫</p>

        <div className="mb-4 flex gap-2">
          <button
            className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold ${pickMode === "grid" ? "bg-accent text-white" : "bg-[#f4f4f4] text-soft"}`}
            onClick={() => switchPickMode("grid")}
          >
            ⌨ 목록에서 고르기
          </button>
          <button
            className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold ${pickMode === "camera" ? "bg-accent text-white" : "bg-[#f4f4f4] text-soft"}`}
            onClick={() => switchPickMode("camera")}
          >
            📷 사진으로 고르기
          </button>
        </div>

        {pickMode === "grid" && (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`item-tile ${submitting ? "pointer-events-none opacity-50" : ""}`}
                  onClick={() => submitChoice(it.id)}
                >
                  <span className="mb-1.5 block text-3xl">{it.emoji}</span>
                  <span className="text-[13px] font-semibold">{it.name}</span>
                </div>
              ))}
            </div>
            {error && <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>}
          </>
        )}

        {pickMode === "camera" && (
          <div className="card">
            {photoStatus === "idle" && (
              <>
                <p className="mb-1 text-center text-sm text-soft">
                  좋아하는 걸 사진으로 찍으면 AI가 뭔지 맞혀볼게요!
                </p>
                <p className="mb-3 text-center text-xs text-soft">사람은 나오지 않게, 물건만 찍어주세요 🙂</p>
                <button className="btn btn-primary mb-0" onClick={() => fileInputRef.current?.click()}>
                  📷 사진 찍기
                </button>
                {photoError && <p className="mt-3 text-sm font-semibold text-red-500">{photoError}</p>}
              </>
            )}

            {photoStatus === "analyzing" && (
              <div className="text-center">
                {capturedPreview && (
                  <img src={capturedPreview} alt="찍은 사진" className="mx-auto mb-3 h-40 w-40 rounded-2xl object-cover" />
                )}
                <div className="spinner mx-auto my-3 h-10 w-10 animate-spin rounded-full border-[5px] border-[#f0f0f0] border-t-accent" />
                <p className="text-sm text-soft">AI가 사진을 보는 중...</p>
              </div>
            )}

            {photoStatus === "confirm" && aiSuggestion && (
              <div className="text-center">
                {capturedPreview && (
                  <img src={capturedPreview} alt="찍은 사진" className="mx-auto mb-3 h-40 w-40 rounded-2xl object-cover" />
                )}
                <p className="mb-4 font-bold">
                  {itemById.get(aiSuggestion.itemId ?? "")?.emoji} {aiSuggestion.label} 맞아요?
                </p>
                <button className="btn btn-primary" disabled={submitting} onClick={confirmAiChoice}>
                  {submitting ? "저장하는 중..." : "네, 맞아요!"}
                </button>
                <button className="btn btn-outline mb-0" onClick={retakePhoto}>
                  다시 찍을래요
                </button>
              </div>
            )}

            {photoStatus === "unmatched" && (
              <div className="text-center">
                {capturedPreview && (
                  <img src={capturedPreview} alt="찍은 사진" className="mx-auto mb-3 h-40 w-40 rounded-2xl object-cover" />
                )}
                <p className="mb-4 text-sm text-soft">음, 뭔지 잘 모르겠어요. 다시 찍거나 목록에서 골라줄래?</p>
                <button className="btn btn-outline" onClick={retakePhoto}>다시 찍기</button>
                <button className="btn btn-ghost mb-0" onClick={() => switchPickMode("grid")}>목록에서 고를래요</button>
              </div>
            )}

            {error && <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  // ---- 2. 냈지만 상대는 아직 -> 대기 화면 ----
  // 부모는 위 관전 화면에서 !revealed 인 동안 이미 걸러지므로, 여기 도달했다면 myChoice 는 항상 존재한다.
  if (!revealed) {
    const myItem = itemById.get(myChoice!.item_id);
    return (
      <div className="app-shell items-center justify-center">
        <div className="card center text-center">
          <span className="text-4xl">{myItem?.emoji}</span>
          <p className="mt-2 font-bold">{myItem?.name}을(를) 골랐어요!</p>
          <div className="spinner mx-auto my-6 h-11 w-11 animate-spin rounded-full border-[5px] border-[#f0f0f0] border-t-accent" />
          <p className="text-sm text-soft">상대방이 고르는 중... 잠깐 기다려줘 😊</p>
        </div>
        <Link href="/home" className="btn btn-ghost text-center">나중에 결과 볼게요</Link>
      </div>
    );
  }

  // ---- 3. 공개됨, 아직 조율 결과 없음 ----
  if (!resolution) {
    if (matched) {
      return (
        <div className="app-shell items-center justify-center">
          <div className="card center text-center">
            <h2 className="mb-2 text-[19px] font-bold">{catLabel}</h2>
            <div className="badge-match mb-2 inline-block rounded-full bg-[#E4FCE8] px-4 py-2 text-sm font-bold text-[#1B9E4B]">
              🎉 취향이 딱 맞았어요!
            </div>
            <div className="my-4 flex justify-center gap-3">
              {choices.map((c) => {
                const p = profileById.get(c.profile_id);
                const it = itemById.get(c.item_id);
                return (
                  <div key={c.id} className="flex-1 rounded-2xl bg-a-light p-4">
                    <span className="mb-1.5 block text-4xl">{it?.emoji}</span>
                    <div className="text-sm">{p?.name}</div>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary" onClick={confirmMatch}>완료! 🙌</button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-shell">
        <div className="card center text-center">
          <h2 className="mb-2 text-[19px] font-bold">{catLabel}</h2>
          <div className="mb-2 inline-block rounded-full bg-[#FFF0E0] px-4 py-2 text-sm font-bold text-[#D9822B]">
            서로 다른 걸 골랐어요! 완전 좋아요 ✨
          </div>
          <div className="my-4 flex justify-center gap-3">
            {choices.map((c) => {
              const p = profileById.get(c.profile_id);
              const it = itemById.get(c.item_id);
              return (
                <div key={c.id} className="flex-1 rounded-2xl bg-b-light p-4">
                  <span className="mb-1.5 block text-4xl">{it?.emoji}</span>
                  <div className="text-sm">{p?.name}: {it?.name}</div>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-soft">어떻게 정할까요?</p>
        </div>

        <div className="card">
          <div className="mb-4 text-center text-5xl transition-transform duration-[1800ms]" style={{ transform: spinning ? "rotate(1080deg)" : "none" }}>
            🎯
          </div>
          <button className="btn btn-primary" disabled={spinning} onClick={spinRoulette}>
            {spinning ? "돌리는 중..." : "🎡 룰렛 돌리기 (반반 확률)"}
          </button>
          <button className="btn btn-outline" onClick={resolveTurn}>🔄 번갈아하기 (이번엔 누구 차례?)</button>
          <button className="btn btn-outline" onClick={resolveBoth}>🤝 둘 다 하기</button>
          <div className="small-row flex gap-2">
            {choices.map((c) => {
              const p = profileById.get(c.profile_id);
              return (
                <button key={c.id} className="btn btn-ghost mb-0 flex-1 border-2 border-[#eee]" onClick={() => resolveManual(c.profile_id)}>
                  ✋ {p?.name} 선택으로
                </button>
              );
            })}
          </div>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-red-500">{error}</p>}
      </div>
    );
  }

  // ---- 4. 결과 확정됨 ----
  const winner = resolution.winner_profile_id ? profileById.get(resolution.winner_profile_id) : null;
  const typeLabel: Record<string, string> = {
    match: "취향이 같았어요",
    roulette: "룰렛으로 정했어요",
    turn: "번갈아하기로 정했어요",
    both: "둘 다 하기로 했어요",
    manual: "직접 정했어요",
  };

  return (
    <div className="app-shell items-center justify-center">
      <div className="card center text-center">
        <div className="text-5xl">✅</div>
        <h2 className="mt-2 text-[19px] font-bold">기록 완료!</h2>
        <p className="mt-1 text-sm text-soft">{catLabel} · {typeLabel[resolution.type]}</p>
        {winner && <p className="mt-2 font-bold">{winner.avatar} {winner.name} 우선!</p>}
        <button className="btn btn-primary mt-4" onClick={() => router.push("/home")}>홈으로</button>
      </div>
    </div>
  );
}
