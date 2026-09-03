"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeImageForUpload } from "@/lib/imageResize";
import { Avatar } from "@/components/Avatar";

type Child = { id: string; name: string; avatar: string; avatar_photo_path: string | null; created_at: string };

const AVATAR_OPTIONS = ["🧒", "👦", "👧", "🐻", "🐰", "🦁", "🐼", "🦊"];

export function ChildrenManager({
  familyId,
  joinCode,
  initialChildren,
  avatarUrls,
}: {
  familyId: string;
  joinCode: string;
  initialChildren: Child[];
  avatarUrls: Record<string, string>;
}) {
  const [children, setChildren] = useState<Child[]>(initialChildren);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(avatarUrls);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetChildId = useRef<string | null>(null);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "자녀 프로필을 만들지 못했어요.");
        return;
      }
      setChildren((prev) => [...prev, { ...data.child, avatar_photo_path: null, created_at: new Date().toISOString() }]);
      setName("");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  async function deleteChild(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/children/${id}`, { method: "DELETE" });
      if (res.ok) {
        setChildren((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setLoading(false);
      setConfirmDeleteId(null);
    }
  }

  function pickPhotoFor(childId: string) {
    setPhotoError(null);
    targetChildId.current = childId;
    fileInputRef.current?.click();
  }

  async function handlePhotoSelected(file: File) {
    const childId = targetChildId.current;
    if (!childId) return;
    setPhotoUploadingId(childId);
    setPhotoError(null);

    try {
      // 512px 면 아바타 용도로 충분하고, 원본을 그대로 올리면 느리고 용량도 커진다(이미지는
      // 항상 브라우저에서 축소+재압축 후 업로드 — src/lib/imageResize.ts).
      const resized = await resizeImageForUpload(file, 512, 0.85);
      const base64 = resized.dataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const storagePath = `${familyId}/${childId}.jpg`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true });
      if (uploadError) {
        setPhotoError("사진을 올리지 못했어요.");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_photo_path: storagePath })
        .eq("id", childId);
      if (updateError) {
        setPhotoError("사진을 연결하지 못했어요.");
        return;
      }

      setPhotoUrls((prev) => ({ ...prev, [childId]: resized.dataUrl }));
      setChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, avatar_photo_path: storagePath } : c)));
    } catch {
      setPhotoError("사진을 처리하지 못했어요.");
    } finally {
      setPhotoUploadingId(null);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoSelected(file);
          e.target.value = "";
        }}
      />

      <div className="card">
        <p className="mb-1 text-sm text-soft">가족 코드 (자녀 로그인 화면에서 입력)</p>
        <div className="rounded-2xl bg-accent/10 py-3 text-center text-2xl font-extrabold tracking-[0.3em] text-accent">
          {joinCode}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-bold">자녀 목록</h3>
        <p className="mb-3 text-xs text-soft">사진을 탭하면 아이 얼굴 사진으로 바꿀 수 있어요.</p>
        {children.length === 0 && <p className="text-sm text-soft">아직 등록된 자녀가 없어요.</p>}
        {children.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-[#f4f4f4] py-2.5 last:border-none">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => pickPhotoFor(c.id)}
                disabled={photoUploadingId === c.id}
                className="relative h-10 w-10 shrink-0 rounded-full disabled:opacity-50"
              >
                <Avatar url={photoUrls[c.id]} emoji={c.avatar} size={40} />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] shadow">
                  {photoUploadingId === c.id ? "…" : "📷"}
                </span>
              </button>
              <span className="font-semibold">{c.name}</span>
            </div>
            {confirmDeleteId === c.id ? (
              <div className="flex gap-1.5">
                <button className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-bold text-white" disabled={loading} onClick={() => deleteChild(c.id)}>
                  삭제 확정
                </button>
                <button className="rounded-lg bg-[#f0f0f0] px-2.5 py-1.5 text-xs font-bold" onClick={() => setConfirmDeleteId(null)}>
                  취소
                </button>
              </div>
            ) : (
              <button className="text-xs font-semibold text-soft underline" onClick={() => setConfirmDeleteId(c.id)}>
                데이터 전체 삭제
              </button>
            )}
          </div>
        ))}
        {photoError && <p className="mt-2 text-sm font-semibold text-red-500">{photoError}</p>}
      </div>

      <form className="card" onSubmit={addChild}>
        <h3 className="mb-3 font-bold">자녀 추가하기</h3>
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-[15px]"
        />
        <div className="mb-2.5 grid grid-cols-8 gap-1.5">
          {AVATAR_OPTIONS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setAvatar(a)}
              className={`rounded-xl border-2 py-2 text-xl ${avatar === a ? "border-accent" : "border-[#eee]"}`}
            >
              {a}
            </button>
          ))}
        </div>
        <input
          type="text"
          inputMode="numeric"
          placeholder="PIN 4자리"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          required
          maxLength={4}
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-center text-lg font-bold tracking-[0.3em]"
        />
        {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mb-0" disabled={loading || pin.length !== 4}>
          {loading ? "추가 중..." : "추가하기"}
        </button>
      </form>
    </>
  );
}
