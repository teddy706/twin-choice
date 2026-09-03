"use client";

import { useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { NavBar } from "@/components/NavBar";
import type { ProfileWithAvatar } from "@/lib/currentProfile";

type CategoryOption = { id: string; name: string; emoji: string };
type ProfileOption = { id: string; name: string; avatar: string };
type ItemOption = { id: string; name: string; emoji: string; category_id: string };
type ChoiceRow = { round_id: string; profile_id: string; item_id: string | null; label: string | null; photo_id: string | null };
type ResolutionRow = {
  id: string;
  round_id: string;
  type: string;
  winner_profile_id: string | null;
  resolved_at: string;
  rounds: { id: string; family_id: string; category_id: string };
};

export function HistoryView({
  profile,
  categories,
  resolutions,
  profiles,
  items,
  choices,
  photoUrls,
}: {
  profile: ProfileWithAvatar;
  categories: CategoryOption[];
  resolutions: ResolutionRow[];
  profiles: ProfileOption[];
  items: ItemOption[];
  choices: ChoiceRow[];
  photoUrls: Record<string, string>;
}) {
  const [tab, setTab] = useState<string>("all");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const choicesByRound = useMemo(() => {
    const m = new Map<string, ChoiceRow[]>();
    for (const c of choices) {
      const arr = m.get(c.round_id) ?? [];
      arr.push(c);
      m.set(c.round_id, arr);
    }
    return m;
  }, [choices]);

  const filtered = resolutions.filter((r) => tab === "all" || r.rounds.category_id === tab);

  const tagLabel = (type: string) => (type === "match" ? "일치" : type === "both" ? "둘다" : "조율");
  const tagStyle = (type: string) =>
    type === "match" ? "bg-[#E4FCE8] text-[#1B9E4B]" : "bg-[#FFF0E0] text-[#D9822B]";

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <h2 className="mb-3.5 text-[19px] font-bold">📜 기록</h2>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        <button
          className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-bold ${tab === "all" ? "bg-accent text-white" : "bg-[#f4f4f4] text-soft"}`}
          onClick={() => setTab("all")}
        >
          전체
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-bold ${tab === c.id ? "bg-accent text-white" : "bg-[#f4f4f4] text-soft"}`}
            onClick={() => setTab(c.id)}
          >
            {c.emoji}
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-soft">아직 기록이 없어요.<br />새로운 선택을 시작해보세요!</div>
        ) : (
          filtered.map((r) => {
            const cat = categoryById.get(r.rounds.category_id);
            const roundChoices = choicesByRound.get(r.round_id) ?? [];
            const d = new Date(r.resolved_at);
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
            return (
              <div key={r.id} className="flex items-center gap-2.5 border-b border-[#f4f4f4] py-3 last:border-none">
                <div className="w-[52px] shrink-0 text-[11px] text-soft">{dateStr}</div>
                <div className="flex-1 text-sm">
                  {cat?.emoji} {cat?.name} —{" "}
                  {roundChoices.map((c, i) => {
                    const p = profileById.get(c.profile_id);
                    const it = c.item_id ? itemById.get(c.item_id) : null;
                    const photoUrl = c.photo_id ? photoUrls[c.photo_id] : undefined;
                    return (
                      <span key={c.round_id + c.profile_id} className="inline-flex items-center gap-1 align-middle">
                        {i > 0 && " / "}
                        {p?.name}:{" "}
                        {photoUrl ? (
                          <img src={photoUrl} alt={c.label ?? ""} className="inline-block h-5 w-5 rounded-md object-cover align-middle" />
                        ) : (
                          it?.emoji
                        )}
                        {it?.name ?? c.label}
                      </span>
                    );
                  })}
                </div>
                <div className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tagStyle(r.type)}`}>
                  {tagLabel(r.type)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <NavBar role={profile.role} />
    </div>
  );
}
