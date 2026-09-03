"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Photo = {
  id: string;
  profile_id: string;
  storage_path: string;
  ai_category: string | null;
  ai_label: string | null;
  confirmed: boolean;
  created_at: string;
};
type ProfileOption = { id: string; name: string; avatar: string };
type CategoryOption = { name: string; emoji: string };

export function PhotoArchive({
  initialPhotos,
  profiles,
  categories,
  photoUrls,
}: {
  initialPhotos: Photo[];
  profiles: ProfileOption[];
  categories: CategoryOption[];
  photoUrls: Record<string, string>;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [tab, setTab] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const emojiByCategory = useMemo(() => new Map(categories.map((c) => [c.name, c.emoji])), [categories]);

  const presentCategories = useMemo(() => {
    const names = new Set<string>();
    for (const p of photos) if (p.ai_category) names.add(p.ai_category);
    return Array.from(names);
  }, [photos]);

  const filtered = tab === "all" ? photos : photos.filter((p) => p.ai_category === tab);

  function startEdit(photo: Photo) {
    setEditingId(photo.id);
    setDraftLabel(photo.ai_label ?? "");
  }

  async function saveLabel(photoId: string) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("photos").update({ ai_label: draftLabel.trim() || null }).eq("id", photoId);
    setSaving(false);
    if (error) return;
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, ai_label: draftLabel.trim() || null } : p)));
    setEditingId(null);
  }

  if (photos.length === 0) {
    return (
      <div className="card py-10 text-center text-soft">
        아직 모은 사진이 없어요.
        <br />
        자녀가 "사진으로 고르기"를 쓰면 여기에 쌓여요.
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        <button
          className={`shrink-0 rounded-xl px-3 py-2.5 text-[13px] font-bold ${tab === "all" ? "bg-accent text-white" : "bg-[#f4f4f4] text-soft"}`}
          onClick={() => setTab("all")}
        >
          전체
        </button>
        {presentCategories.map((name) => (
          <button
            key={name}
            className={`shrink-0 rounded-xl px-3 py-2.5 text-[13px] font-bold ${tab === name ? "bg-accent text-white" : "bg-[#f4f4f4] text-soft"}`}
            onClick={() => setTab(name)}
          >
            {emojiByCategory.get(name) ?? "📷"} {name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filtered.map((photo) => {
          const p = profileById.get(photo.profile_id);
          const url = photoUrls[photo.id];
          const d = new Date(photo.created_at);
          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          const editing = editingId === photo.id;
          return (
            <div key={photo.id} className="card p-2.5">
              {url ? (
                <img src={url} alt={photo.ai_label ?? ""} className="mb-2 aspect-square w-full rounded-xl object-cover" />
              ) : (
                <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-[#f4f4f4] text-3xl">📷</div>
              )}
              <div className="mb-1 flex items-center justify-between text-[11px] text-soft">
                <span>{p?.avatar} {p?.name}</span>
                <span>{dateStr}</span>
              </div>
              {editing ? (
                <div>
                  <input
                    type="text"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    maxLength={30}
                    autoFocus
                    className="mb-1.5 w-full rounded-lg border-2 border-[#eee] p-1.5 text-[13px]"
                  />
                  <div className="flex gap-1.5">
                    <button
                      className="flex-1 rounded-lg bg-accent py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                      disabled={saving}
                      onClick={() => saveLabel(photo.id)}
                    >
                      저장
                    </button>
                    <button
                      className="flex-1 rounded-lg bg-[#f0f0f0] py-1.5 text-[11px] font-bold"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button className="w-full text-left text-[13px] font-semibold" onClick={() => startEdit(photo)}>
                  {photo.ai_label || <span className="text-soft">라벨 없음</span>} <span className="text-soft">✏️</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
