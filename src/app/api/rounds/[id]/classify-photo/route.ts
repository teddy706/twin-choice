import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyPhotoAgainstItems } from "@/lib/anthropic";

const MAX_BASE64_LENGTH = 8_000_000; // 대략 원본 6MB 상당

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  // 블라인드 선택 자체는 자녀만 제출한다 (choices RLS의 child-only 제약과 동일 원칙).
  if (!profile || profile.role !== "child") {
    return NextResponse.json({ error: "자녀만 사진으로 고를 수 있어요." }, { status: 403 });
  }

  const { imageBase64, mediaType } = await request.json();
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "사진 데이터가 없어요." }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "사진 용량이 너무 커요." }, { status: 413 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    return NextResponse.json({ error: "지원하지 않는 이미지 형식이에요." }, { status: 400 });
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, family_id, category_id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!round || round.family_id !== profile.family_id) {
    return NextResponse.json({ error: "라운드를 찾을 수 없어요." }, { status: 404 });
  }
  if (round.status !== "waiting") {
    return NextResponse.json({ error: "이미 공개된 라운드예요." }, { status: 400 });
  }

  const [{ data: category }, { data: items }] = await Promise.all([
    supabase.from("categories").select("name").eq("id", round.category_id).maybeSingle(),
    supabase
      .from("items")
      .select("id, name, emoji")
      .eq("category_id", round.category_id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (!category || !items || items.length === 0) {
    return NextResponse.json({ error: "카테고리 정보를 불러오지 못했어요." }, { status: 500 });
  }

  const extension = mediaType.split("/")[1];
  const storagePath = `${profile.family_id}/${profile.id}/${round.id}-${Date.now()}.${extension}`;

  const [classifyResult, uploadResult] = await Promise.all([
    classifyPhotoAgainstItems({
      imageBase64,
      mediaType,
      categoryName: category.name,
      candidates: items,
    }),
    supabase.storage
      .from("photos")
      .upload(storagePath, Buffer.from(imageBase64, "base64"), { contentType: mediaType }),
  ]);

  if (uploadResult.error) {
    return NextResponse.json({ error: "사진을 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({
    storagePath,
    matchedItemId: classifyResult.matchedItemId,
    label: classifyResult.label,
  });
}
