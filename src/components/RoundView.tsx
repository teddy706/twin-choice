"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
  if (!myChoice) {
    return (
      <div className="app-shell">
        <h2 className="mb-1 text-[19px] font-bold">{catLabel} — 좋아하는 걸 골라봐!</h2>
        <p className="sub mb-4 -mt-1 text-sm text-soft">상대방은 네가 뭘 골랐는지 아직 못 봐요 🤫</p>
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
      </div>
    );
  }

  // ---- 2. 냈지만 상대는 아직 -> 대기 화면 ----
  if (!revealed) {
    const myItem = itemById.get(myChoice.item_id);
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
      const myItem = itemById.get(myChoice.item_id);
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
