"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

type CategoryOption = Pick<Category, "id" | "name" | "emoji">;

export function CategoryPicker({
  categories,
  startedBy,
  familyId,
}: {
  categories: CategoryOption[];
  startedBy: string;
  familyId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startRound(categoryId: string) {
    setLoading(categoryId);
    setError(null);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("rounds")
      .insert({ family_id: familyId, category_id: categoryId, started_by: startedBy })
      .select("id")
      .single();

    if (insertError || !data) {
      setError("라운드를 시작하지 못했어요. 다시 시도해주세요.");
      setLoading(null);
      return;
    }
    // 실패해도 게임 진행엔 지장 없는 부가 기능이라 응답을 기다리지 않는다(fire-and-forget).
    fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId: data.id, event: "started" }),
    }).catch(() => {});
    router.push(`/round/${data.id}`);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((c) => (
          <div
            key={c.id}
            className={`item-tile ${loading === c.id ? "opacity-50" : ""}`}
            onClick={() => !loading && startRound(c.id)}
          >
            <span className="mb-1.5 block text-4xl">{c.emoji}</span>
            <span className="text-sm font-semibold">{c.name}</span>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>}
      <Link href="/home" className="btn btn-ghost mt-4 text-center">← 뒤로</Link>
    </>
  );
}
