import "server-only";

// "왜 이게 좋아?" 음성 답변을 텍스트로 바꾼다. Whisper(Azure OpenAI) 대신 Azure AI Speech의
// 단문 인식 REST API를 쓴다 — Whisper 모델은 리전별 배포 제한이 있어 이 프로젝트의 Azure OpenAI
// 리소스(Korea Central)에서는 배포가 불가능했고, reading-buddy가 이미 검증해둔 Azure AI Speech
// 리소스를 대신 재사용하기로 함(twin_choice/CLAUDE.md 참고). 변환 직후 오디오는 어디에도
// 저장하지 않고 텍스트만 반환한다(개인정보 최소화 원칙은 그대로 유지).
export async function transcribeAudio(audio: Buffer, contentType: string): Promise<string> {
  const region = process.env.AZURE_SPEECH_REGION;
  const key = process.env.AZURE_SPEECH_KEY;
  if (!region || !key) throw new Error("Azure AI Speech가 설정되지 않았어요.");

  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ko-KR&format=simple`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": contentType,
      Accept: "application/json",
    },
    body: new Uint8Array(audio),
  });

  if (!response.ok) {
    throw new Error(`음성 인식에 실패했어요. (${response.status})`);
  }

  const data = (await response.json()) as { RecognitionStatus?: string; DisplayText?: string };
  if (data.RecognitionStatus !== "Success" || !data.DisplayText) {
    throw new Error("무슨 말인지 알아듣지 못했어요.");
  }
  return data.DisplayText;
}
