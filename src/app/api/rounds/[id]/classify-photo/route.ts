import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { describePhoto } from "@/lib/azureOpenAI";

// 클라이언트가 업로드 전에 1024px로 축소해서 보내므로 정상 요청은 수백 KB 수준이다.
// Vercel 서버리스 함수의 요청 본문 크기 제한(~4.5MB)보다 한참 낮게 잡아 여유를 둔다.
const MAX_BASE64_LENGTH = 3_000_000; // 대략 원본 2.2MB 상당

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

  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("id", round.category_id)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ error: "카테고리 정보를 불러오지 못했어요." }, { status: 500 });
  }

  const extension = mediaType.split("/")[1];
  const storagePath = `${profile.family_id}/${profile.id}/${round.id}-${Date.now()}.${extension}`;

  const [describeResult, uploadResult] = await Promise.all([
    describePhoto({ imageBase64, mediaType, categoryName: category.name }),
    supabase.storage
      .from("photos")
      .upload(storagePath, Buffer.from(imageBase64, "base64"), { contentType: mediaType }),
  ]);

  if (uploadResult.error) {
    return NextResponse.json({ error: "사진을 저장하지 못했어요." }, { status: 500 });
  }

  // photos row 는 찍는 즉시 만들어둔다(재촬영하면 새 row 가 또 생기는 건 괜찮음 -
  // 최종적으로 choices.photo_id 가 가리키는 것만 "그 라운드의 선택"이 된다).
  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .insert({
      family_id: profile.family_id,
      profile_id: profile.id,
      round_id: round.id,
      storage_path: storagePath,
      ai_category: category.name,
      ai_label: describeResult.label || null,
      confirmed: false,
    })
    .select("id")
    .single();

  if (photoError || !photo) {
    return NextResponse.json({ error: "사진 정보를 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({
    photoId: photo.id,
    storagePath,
    label: describeResult.label,
    confidence: describeResult.confidence,
  });
}
