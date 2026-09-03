"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; name: string; emoji: string; is_active: boolean; sort_order: number };

const EMOJI_OPTIONS = ["⭐", "🍭", "🧸", "📺", "🎲", "🖍️", "🚗", "⚽", "🎁", "✨"];

export function ItemsManager({ categoryId, initialItems }: { categoryId: string; initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const active = items.filter((i) => i.is_active);
  const inactive = items.filter((i) => !i.is_active);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("items")
      .insert({ category_id: categoryId, name: name.trim(), emoji, sort_order: items.length })
      .select("id, name, emoji, is_active, sort_order")
      .single();
    setLoading(false);
    if (insertError || !data) {
      setError("항목을 만들지 못했어요.");
      return;
    }
    setItems((prev) => [...prev, data]);
    setName("");
  }

  async function toggleActive(item: Item) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("items")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (updateError) {
      setError("변경하지 못했어요.");
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i)));
  }

  function ItemRow({ i }: { i: Item }) {
    return (
      <div className="flex items-center justify-between border-b border-[#f4f4f4] py-2.5 last:border-none">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{i.emoji}</span>
          <span className="font-semibold">{i.name}</span>
        </div>
        <button className="text-xs font-semibold text-soft underline" onClick={() => toggleActive(i)}>
          {i.is_active ? "숨기기" : "다시 켜기"}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h3 className="mb-3 font-bold">항목 목록</h3>
        {active.length === 0 && <p className="text-sm text-soft">아직 항목이 없어요.</p>}
        {active.map((i) => (
          <ItemRow key={i.id} i={i} />
        ))}

        {inactive.length > 0 && (
          <>
            <button
              className="mt-3 text-xs font-semibold text-soft underline"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? "숨긴 항목 접기" : `숨긴 항목 보기 (${inactive.length})`}
            </button>
            {showInactive && (
              <div className="mt-2 opacity-60">
                {inactive.map((i) => (
                  <ItemRow key={i.id} i={i} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <form className="card" onSubmit={addItem}>
        <h3 className="mb-3 font-bold">항목 추가하기</h3>
        <input
          type="text"
          placeholder="이름 (예: 로봇 장난감)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          required
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-[15px]"
        />
        <div className="mb-3 grid grid-cols-10 gap-1.5">
          {EMOJI_OPTIONS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              className={`rounded-xl border-2 py-2 text-xl ${emoji === e ? "border-accent" : "border-[#eee]"}`}
            >
              {e}
            </button>
          ))}
        </div>
        {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mb-0" disabled={loading || !name.trim()}>
          {loading ? "추가 중..." : "추가하기"}
        </button>
      </form>

      <Link href="/settings/categories" className="btn btn-ghost text-center">← 카테고리 목록으로</Link>
    </>
  );
}
