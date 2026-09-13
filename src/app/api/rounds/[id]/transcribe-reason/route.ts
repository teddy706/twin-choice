import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/azureSpeech";

// 음성 녹음(15초 상한이라 사진보다 훨씬 작음)을 base64로 받는다. 여유를 넉넉히 둬도
// Vercel 서버리스 함수의 요청 본문 제한(~4.5MB)에 한참 못 미친다.
const MAX_BASE64_LENGTH = 2_000_000;

// "왜 이게 좋아?" 음성 -> 텍스트 변환만 한다. choices.reason 저장은 이 라우트가 하지 않고,
// 변환된 텍스트를 돌려받은 클라이언트가 자녀에게 확인시킨 뒤 직접 저장한다(사진 라벨과 동일한
// "AI 결과는 명시적으로 확인해야 저장" 원칙). 오디오 자체는 여기서 변환에만 쓰고 어디에도 저장하지 않는다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  // middleware.ts가 이미 getUser()로 세션을 검증/갱신했으므로 여기서는 로컬 getSession()으로 읽는다.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, family_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  // 블라인드 선택 자체는 자녀만 제출한다 — 이유 남기기도 같은 원칙.
  if (!profile || profile.role !== "child") {
    return NextResponse.json({ error: "자녀만 이유를 남길 수 있어요." }, { status: 403 });
  }

  const { audioBase64, mediaType } = await request.json();
  if (!audioBase64 || typeof audioBase64 !== "string") {
    return NextResponse.json({ error: "녹음 데이터가 없어요." }, { status: 400 });
  }
  if (audioBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "녹음이 너무 길어요." }, { status: 413 });
  }
  if (!mediaType || typeof mediaType !== "string" || !mediaType.startsWith("audio/")) {
    return NextResponse.json({ error: "지원하지 않는 음성 형식이에요." }, { status: 400 });
  }

  const { data: round } = await supabase
    .from("rounds")
    .select("id, family_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!round || round.family_id !== profile.family_id) {
    return NextResponse.json({ error: "라운드를 찾을 수 없어요." }, { status: 404 });
  }

  try {
    // 클라이언트(pcmRecorder.ts)가 항상 16kHz mono WAV로 인코딩해 보내므로, Azure AI Speech가
    // 요구하는 정확한 content-type을 여기서 고정한다(클라이언트가 보낸 mediaType은 위에서
    // "audio/*" 형식인지 검증하는 용도로만 쓰고, 실제 호출엔 이 값을 쓴다).
    const text = await transcribeAudio(Buffer.from(audioBase64, "base64"), "audio/wav; codecs=audio/pcm; samplerate=16000");
    if (!text) {
      return NextResponse.json({ error: "무슨 말인지 잘 못 들었어요. 다시 말해줄래?" }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    console.error("transcribeAudio failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "지금은 변환하지 못했어요. 잠시 후 다시 시도해줄래?" }, { status: 500 });
  }
}
