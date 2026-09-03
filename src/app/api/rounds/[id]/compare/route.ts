import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { compareChoices, type ChoiceForCompare } from "@/lib/azureOpenAI";

function guessMediaType(storagePath: string): "image/jpeg" | "image/png" | "image/webp" {
  if (storagePath.endsWith(".png")) return "image/png";
  if (storagePath.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

// 공개된 라운드의 두 선택을 비교해 "같은 걸 골랐는지" 판정한다.
// 둘 다 그리드에서 고른 항목이면 item_id 동등 비교로 끝나고(AI 호출 없음),
// 하나라도 사진/자유 라벨 기반이면 사진(들)을 직접 비교시킨다.
// 결과는 rounds.ai_matched 에 캐싱해서 두 자녀가 각자 다시 계산하지 않게 한다.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 403 });

  const { data: round } = await supabase
    .from("rounds")
    .select("id, family_id, status, ai_matched")
    .eq("id", params.id)
    .maybeSingle();
  if (!round || round.family_id !== profile.family_id) {
    return NextResponse.json({ error: "라운드를 찾을 수 없어요." }, { status: 404 });
  }
  if (round.ai_matched !== null) {
    return NextResponse.json({ matched: round.ai_matched });
  }
  if (round.status !== "revealed") {
    return NextResponse.json({ error: "아직 공개되지 않은 라운드예요." }, { status: 400 });
  }

  const { data: choices } = await supabase
    .from("choices")
    .select("id, profile_id, item_id, label, photo_id")
    .eq("round_id", round.id);
  if (!choices || choices.length !== 2) {
    return NextResponse.json({ error: "두 선택을 모두 찾지 못했어요." }, { status: 400 });
  }

  let matched: boolean;

  if (choices[0].item_id && choices[1].item_id) {
    // 둘 다 그리드에서 고른 경우: AI 호출 없이 바로 비교(빠르고 무료).
    matched = choices[0].item_id === choices[1].item_id;
  } else {
    const itemIds = choices.map((c) => c.item_id).filter((id): id is string => !!id);
    const { data: items } = itemIds.length
      ? await supabase.from("items").select("id, name, emoji").in("id", itemIds)
      : { data: [] };
    const itemById = new Map((items ?? []).map((i) => [i.id, i]));

    const sides: ChoiceForCompare[] = [];
    for (const choice of choices) {
      if (choice.item_id) {
        const item = itemById.get(choice.item_id);
        sides.push({ label: item ? `${item.emoji} ${item.name}` : "알 수 없는 항목" });
        continue;
      }

      let image: ChoiceForCompare["image"];
      if (choice.photo_id) {
        const { data: photo } = await supabase.from("photos").select("storage_path").eq("id", choice.photo_id).maybeSingle();
        if (photo) {
          const { data: blob } = await supabase.storage.from("photos").download(photo.storage_path);
          if (blob) {
            const buffer = Buffer.from(await blob.arrayBuffer());
            image = { imageBase64: buffer.toString("base64"), mediaType: guessMediaType(photo.storage_path) };
          }
        }
      }
      sides.push({ label: choice.label ?? "설명 없음", image });
    }

    matched = await compareChoices(sides[0], sides[1]);
  }

  await supabase.from("rounds").update({ ai_matched: matched }).eq("id", round.id);

  return NextResponse.json({ matched });
}
