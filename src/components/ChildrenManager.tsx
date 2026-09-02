"use client";

import { useState } from "react";

type Child = { id: string; name: string; avatar: string; created_at: string };

const AVATAR_OPTIONS = ["🧒", "👦", "👧", "🐻", "🐰", "🦁", "🐼", "🦊"];

export function ChildrenManager({ joinCode, initialChildren }: { joinCode: string; initialChildren: Child[] }) {
  const [children, setChildren] = useState<Child[]>(initialChildren);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      setChildren((prev) => [...prev, { ...data.child, created_at: new Date().toISOString() }]);
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

  return (
    <>
      <div className="card">
        <p className="mb-1 text-sm text-soft">가족 코드 (자녀 로그인 화면에서 입력)</p>
        <div className="rounded-2xl bg-accent/10 py-3 text-center text-2xl font-extrabold tracking-[0.3em] text-accent">
          {joinCode}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-bold">자녀 목록</h3>
        {children.length === 0 && <p className="text-sm text-soft">아직 등록된 자녀가 없어요.</p>}
        {children.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-[#f4f4f4] py-2.5 last:border-none">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{c.avatar}</span>
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
