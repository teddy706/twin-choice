"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; emoji: string; is_active: boolean; sort_order: number };

const EMOJI_OPTIONS = ["📦", "🎯", "🎨", "🎮", "📚", "🎵", "🍿", "🧩", "🎪", "⭐"];

export function CategoriesManager({
  familyId,
  initialCategories,
  itemCountByCategory,
}: {
  familyId: string;
  initialCategories: Category[];
  itemCountByCategory: Record<string, number>;
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const active = categories.filter((c) => c.is_active);
  const inactive = categories.filter((c) => !c.is_active);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({ family_id: familyId, name: name.trim(), emoji, sort_order: categories.length })
      .select("id, name, emoji, is_active, sort_order")
      .single();
    setLoading(false);
    if (insertError || !data) {
      setError("카테고리를 만들지 못했어요.");
      return;
    }
    setCategories((prev) => [...prev, data]);
    setName("");
  }

  async function toggleActive(category: Category) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);
    if (updateError) {
      setError("변경하지 못했어요.");
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, is_active: !c.is_active } : c)));
  }

  function CategoryRow({ c }: { c: Category }) {
    return (
      <div className="flex items-center justify-between border-b border-[#f4f4f4] py-2.5 last:border-none">
        <Link href={`/settings/categories/${c.id}`} className="flex flex-1 items-center gap-2">
          <span className="text-2xl">{c.emoji}</span>
          <span>
            <div className="font-semibold">{c.name}</div>
            <div className="text-xs text-soft">항목 {itemCountByCategory[c.id] ?? 0}개 · 관리 →</div>
          </span>
        </Link>
        <button className="text-xs font-semibold text-soft underline" onClick={() => toggleActive(c)}>
          {c.is_active ? "숨기기" : "다시 켜기"}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h3 className="mb-3 font-bold">카테고리 목록</h3>
        {active.length === 0 && <p className="text-sm text-soft">아직 카테고리가 없어요.</p>}
        {active.map((c) => (
          <CategoryRow key={c.id} c={c} />
        ))}

        {inactive.length > 0 && (
          <>
            <button
              className="mt-3 text-xs font-semibold text-soft underline"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? "숨긴 카테고리 접기" : `숨긴 카테고리 보기 (${inactive.length})`}
            </button>
            {showInactive && (
              <div className="mt-2 opacity-60">
                {inactive.map((c) => (
                  <CategoryRow key={c.id} c={c} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <form className="card" onSubmit={addCategory}>
        <h3 className="mb-3 font-bold">카테고리 추가하기</h3>
        <input
          type="text"
          placeholder="이름 (예: 책)"
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
    </>
  );
}
