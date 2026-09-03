"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resizeImageForUpload } from "@/lib/imageResize";
import type { Choice, Item, Profile, Resolution, Round, Category } from "@/lib/types";

type FamilyProfile = Pick<Profile, "id" | "name" | "avatar" | "role">;
type RoundRow = Pick<Round, "id" | "family_id" | "category_id" | "status" | "expected_participants" | "started_by" | "ai_matched">;
type ItemOption = Pick<Item, "id" | "name" | "emoji">;
type CategoryInfo = Pick<Category, "id" | "name" | "emoji"> | null;
type ChoiceRow = Pick<Choice, "id" | "profile_id" | "item_id" | "label" | "photo_id" | "submitted_at">;

const TEMP_PREFIX = "temp-";

export function RoundView({
  profile,
  round,
  category,
  items,
  familyProfiles,
  initialChoices,
  initialResolution,
  photoUrls,
}: {
  profile: Profile;
  round: RoundRow;
  category: CategoryInfo;
  items: ItemOption[];
  familyProfiles: FamilyProfile[];
  initialChoices: ChoiceRow[];
  initialResolution: Resolution | null;
  photoUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<ChoiceRow[]>(initialChoices);
  const [resolution, setResolution] = useState<Resolution | null>(initialResolution);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "사진으로 고르기" 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickMode, setPickMode] = useState<"grid" | "camera">("grid");
  const [photoStatus, setPhotoStatus] = useState<"idle" | "analyzing" | "confirm" | "manual">("idle");
  const [photoSubmitting, setPhotoSubmitting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [aiPhoto, setAiPhoto] = useState<{ photoId: string; label: string } | null>(null);
  const [manualLabel, setManualLabel] = useState("");

  // 공개 시점 비교(그리드끼리는 무료/즉시, 사진이 하나라도 끼면 AI 비교) 상태
  const [matchResult, setMatchResult] = useState<boolean | null>(round.ai_matched);
  const matchRequestedRef = useRef(false);

  const profileById = useMemo(() => new Map(familyProfiles.map((p) => [p.id, p])), [familyProfiles]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Supabase Realtime(postgres_changes) 구독 + 3초 폴링 폴백.
  // profile_id 기준으로 병합해야 한다 — 아니면 낙관적 업데이트로 먼저 넣어둔 임시 row 와
  // 서버에서 도착한 진짜 row 가 같은 사람인데도 둘 다 남아 인원수 계산이 틀어질 수 있다.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`round-${round.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "choices", filter: `round_id=eq.${round.id}` },
        (payload) => {
          const row = payload.new as ChoiceRow;
          setChoices((prev) => [...prev.filter((c) => c.profile_id !== row.profile_id), row]);
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
        .select("id, profile_id, item_id, label, photo_id, submitted_at")
        .eq("round_id", round.id);
      if (freshChoices) {
        setChoices((prev) => {
          const stillPendingOptimistic = prev.filter(
            (c) => c.id.startsWith(TEMP_PREFIX) && !freshChoices.some((f) => f.profile_id === c.profile_id)
          );
          return [...freshChoices, ...stillPendingOptimistic];
        });
      }

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
  const revealed = choices.length >= round.expected_participants;
  const participantIds = choices.map((c) => c.profile_id);

  // 공개되면 한 번만 비교를 요청한다. 둘 다 그리드 선택이면 서버가 AI 호출 없이 바로 답하고,
  // 이미 계산된 적 있으면(다른 쪽 화면에서 먼저 요청) rounds.ai_matched 캐시를 그대로 돌려준다.
  useEffect(() => {
    if (!revealed || resolution || matchResult !== null || matchRequestedRef.current) return;
    matchRequestedRef.current = true;
    fetch(`/api/rounds/${round.id}/compare`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.matched === "boolean") setMatchResult(data.matched);
      })
      .catch(() => {})
      .finally(() => {
        matchRequestedRef.current = false;
      });
  }, [revealed, resolution, matchResult, round.id]);

  function choiceDisplay(c: ChoiceRow) {
    if (c.item_id) {
      const it = itemById.get(c.item_id);
      return { emoji: it?.emoji ?? "❓", name: it?.name ?? "", photoUrl: undefined as string | undefined };
    }
    return { emoji: "📷", name: c.label ?? "", photoUrl: c.photo_id ? photoUrls[c.photo_id] : undefined };
  }

  // 이 제출이 라운드를 공개 상태로 만드는 "마지막 한 명"이면 상대에게 푸시를 보낸다.
  // 실패해도 게임 진행엔 지장 없는 부가 기능이라 응답을 기다리지 않는다(fire-and-forget).
  function notifyIfThisRevealsRound(countBeforeThisSubmission: number) {
    if (countBeforeThisSubmission + 1 >= round.expected_participants) {
      fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: round.id, event: "revealed" }),
      }).catch(() => {});
    }
  }

  // 탭 즉시 화면을 넘기고(낙관적 업데이트), 저장은 뒤에서 처리한다 — 실패하면 되돌린다.
  // 네트워크 왕복을 기다렸다가 화면이 넘어가면 탭이 "느리게" 느껴지기 때문.
  async function submitChoice(itemId: string) {
    setError(null);
    const countBefore = choices.length;
    const tempId = `${TEMP_PREFIX}${Date.now()}`;
    const optimistic: ChoiceRow = {
      id: tempId,
      profile_id: profile.id,
      item_id: itemId,
      label: null,
      photo_id: null,
      submitted_at: new Date().toISOString(),
    };
    setChoices((prev) => [...prev, optimistic]);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("choices")
      .insert({ round_id: round.id, profile_id: profile.id, item_id: itemId })
      .select("id, profile_id, item_id, label, photo_id, submitted_at")
      .single();

    if (insertError || !data) {
      setChoices((prev) => prev.filter((c) => c.id !== tempId));
      setError("선택을 저장하지 못했어요. 다시 눌러줄래?");
      return;
    }
    setChoices((prev) => prev.map((c) => (c.id === tempId ? data : c)));
    notifyIfThisRevealsRound(countBefore);
  }

  async function submitPhotoChoice(label: string, photoId: string) {
    if (!label.trim()) {
      setPhotoError("뭔지 짧게라도 적어줘야 해요.");
      return;
    }
    setPhotoSubmitting(true);
    setPhotoError(null);

    const countBefore = choices.length;
    const tempId = `${TEMP_PREFIX}${Date.now()}`;
    const optimistic: ChoiceRow = {
      id: tempId,
      profile_id: profile.id,
      item_id: null,
      label,
      photo_id: photoId,
      submitted_at: new Date().toISOString(),
    };
    setChoices((prev) => [...prev, optimistic]);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("choices")
      .insert({ round_id: round.id, profile_id: profile.id, item_id: null, label, photo_id: photoId })
      .select("id, profile_id, item_id, label, photo_id, submitted_at")
      .single();

    if (insertError || !data) {
      setChoices((prev) => prev.filter((c) => c.id !== tempId));
      setPhotoError("선택을 저장하지 못했어요. 다시 시도해줄래?");
      setPhotoSubmitting(false);
      return;
    }
    setChoices((prev) => prev.map((c) => (c.id === tempId ? data : c)));
    notifyIfThisRevealsRound(countBefore);
    setPhotoSubmitting(false);
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
      setAiPhoto({ photoId: data.photoId, label: data.label ?? "" });
      if (data.confidence === "low" || !data.label) {
        setManualLabel(data.label ?? "");
        setPhotoStatus("manual");
      } else {
        setPhotoStatus("confirm");
      }
    } catch {
      setPhotoError("네트워크가 불안정해서 실패했어요. 다시 시도해줄래?");
      setPhotoStatus("idle");
    }
  }

  function retakePhoto() {
    setAiPhoto(null);
    setCapturedPreview(null);
    setManualLabel("");
    setPhotoStatus("idle");
    fileInputRef.current?.click();
  }

  function switchPickMode(mode: "grid" | "camera") {
    setPickMode(mode);
    setAiPhoto(null);
    setCapturedPreview(null);
    setManualLabel("");
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
                <div key={it.id} className="item-tile" onClick={() => submitChoice(it.id)}>
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
                  좋아하는 걸 사진으로 찍으면 AI가 뭔지 봐줄게요!
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

            {photoStatus === "confirm" && aiPhoto && (
              <div className="text-center">
                {capturedPreview && (
                  <img src={capturedPreview} alt="찍은 사진" className="mx-auto mb-3 h-40 w-40 rounded-2xl object-cover" />
                )}
                <p className="mb-4 font-bold">{aiPhoto.label} 맞아요?</p>
                <button
                  className="btn btn-primary"
                  disabled={photoSubmitting}
                  onClick={() => submitPhotoChoice(aiPhoto.label, aiPhoto.photoId)}
                >
                  {photoSubmitting ? "저장하는 중..." : "네, 맞아요!"}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setManualLabel(aiPhoto.label);
                    setPhotoStatus("manual");
                  }}
                >
                  아니요, 다르게 쓸래요
                </button>
                <button className="btn btn-ghost mb-0" onClick={retakePhoto}>다시 찍을래요</button>
              </div>
            )}

            {photoStatus === "manual" && aiPhoto && (
              <div className="text-center">
                {capturedPreview && (
                  <img src={capturedPreview} alt="찍은 사진" className="mx-auto mb-3 h-40 w-40 rounded-2xl object-cover" />
                )}
                <p className="mb-2 text-sm text-soft">이게 뭔지 짧게 적어줄래?</p>
                <input
                  type="text"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  placeholder="예: 딸기맛 젤리"
                  maxLength={30}
                  className="mb-3 w-full rounded-2xl border-2 border-[#eee] p-3 text-center text-[15px]"
                />
                <button
                  className="btn btn-primary"
                  disabled={photoSubmitting || !manualLabel.trim()}
                  onClick={() => submitPhotoChoice(manualLabel, aiPhoto.photoId)}
                >
                  {photoSubmitting ? "저장하는 중..." : "이걸로 할래요"}
                </button>
                <button className="btn btn-ghost mb-0" onClick={retakePhoto}>다시 찍을래요</button>
              </div>
            )}

            {photoError && <p className="mt-3 text-sm font-semibold text-red-500">{photoError}</p>}
          </div>
        )}
      </div>
    );
  }

  // ---- 2. 냈지만 상대는 아직 -> 대기 화면 ----
  // 부모는 위 관전 화면에서 !revealed 인 동안 이미 걸러지므로, 여기 도달했다면 myChoice 는 항상 존재한다.
  if (!revealed) {
    const mine = choiceDisplay(myChoice!);
    return (
      <div className="app-shell items-center justify-center">
        <div className="card center text-center">
          {mine.photoUrl ? (
            <img src={mine.photoUrl} alt="내 선택" className="mx-auto h-24 w-24 rounded-2xl object-cover" />
          ) : (
            <span className="text-4xl">{mine.emoji}</span>
          )}
          <p className="mt-2 font-bold">{mine.name}을(를) 골랐어요!</p>
          <div className="spinner mx-auto my-6 h-11 w-11 animate-spin rounded-full border-[5px] border-[#f0f0f0] border-t-accent" />
          <p className="text-sm text-soft">상대방이 고르는 중... 잠깐 기다려줘 😊</p>
        </div>
        <Link href="/home" className="btn btn-ghost text-center">나중에 결과 볼게요</Link>
      </div>
    );
  }

  // ---- 3. 공개됨, 아직 비교/조율 결과 없음 ----
  if (!resolution) {
    // 그리드끼리는 서버가 즉시 답하지만, 사진이 끼면 AI 호출이 필요해 잠깐 기다려야 한다.
    if (matchResult === null) {
      return (
        <div className="app-shell items-center justify-center">
          <div className="card center text-center">
            <h2 className="mb-2 text-[19px] font-bold">{catLabel}</h2>
            <div className="spinner mx-auto my-6 h-11 w-11 animate-spin rounded-full border-[5px] border-[#f0f0f0] border-t-accent" />
            <p className="text-sm text-soft">둘이 같은 걸 골랐는지 AI가 비교하는 중...</p>
          </div>
        </div>
      );
    }

    if (matchResult) {
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
                const d = choiceDisplay(c);
                return (
                  <div key={c.id} className="flex-1 rounded-2xl bg-a-light p-4">
                    {d.photoUrl ? (
                      <img src={d.photoUrl} alt={d.name} className="mx-auto mb-1.5 h-16 w-16 rounded-xl object-cover" />
                    ) : (
                      <span className="mb-1.5 block text-4xl">{d.emoji}</span>
                    )}
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
              const d = choiceDisplay(c);
              return (
                <div key={c.id} className="flex-1 rounded-2xl bg-b-light p-4">
                  {d.photoUrl ? (
                    <img src={d.photoUrl} alt={d.name} className="mx-auto mb-1.5 h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <span className="mb-1.5 block text-4xl">{d.emoji}</span>
                  )}
                  <div className="text-sm">{p?.name}: {d.name}</div>
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
