import "server-only";
import { AzureOpenAI } from "openai/azure";

// "사진으로 고르기": 정해진 항목 목록에 억지로 끼워맞추지 않고, AI가 사진을 보고
// 자유롭게 설명(라벨)한다. 같은 걸 골랐는지 판단은 공개 시점에 양쪽 사진(또는 사진+라벨)을
// 직접 비교시켜서 정한다("항목 카탈로그 매칭"이 아니라 "사진끼리 비교"). 호출은 사진을 찍거나
// 공개되는 순간에만 일어나고, 자동/백그라운드 호출은 없다.

let client: AzureOpenAI | null = null;
function getClient() {
  if (!client) {
    client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });
  }
  return client;
}

// 음성 "이유 남기기" 변환은 Whisper가 아니라 Azure AI Speech를 쓴다(src/lib/azureSpeech.ts) —
// Whisper 모델은 이 프로젝트의 Azure OpenAI 리소스 리전에서 배포가 불가능해서, reading-buddy가
// 이미 검증해둔 Azure AI Speech 리소스를 재사용하기로 함(twin_choice/CLAUDE.md 참고).

type ImageInput = { imageBase64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export interface DescribeResult {
  label: string;
  confidence: "high" | "medium" | "low";
}

export async function describePhoto(params: ImageInput & { categoryName: string }): Promise<DescribeResult> {
  const { imageBase64, mediaType, categoryName } = params;

  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    max_tokens: 128,
    messages: [
      {
        role: "system",
        content:
          "너는 아이가 찍은 사물 사진을 짧은 한국어 이름으로 설명하는 도우미다. " +
          "사람이 사진에 있어도 사람에 대해서는 언급하지 말고 사물만 본다. " +
          "사진이 흐릿하거나 뭔지 확신할 수 없으면 억지로 지어내지 말고 confidence 를 low 로 답한다.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `카테고리: ${categoryName}\n이 사진 속 물건이 뭔지 짧게(3~8글자) 설명해줘.` },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
        ],
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "describe_photo",
          description: "사진 속 물건을 짧게 설명한다.",
          parameters: {
            type: "object",
            properties: {
              label: { type: "string", description: "사진 속 사물의 짧은 한국어 이름(예: '감자칩', '곰돌이 젤리')." },
              confidence: { type: "string", enum: ["high", "medium", "low"], description: "이 설명이 맞다고 얼마나 확신하는지." },
            },
            required: ["label", "confidence"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "describe_photo" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    return { label: "", confidence: "low" };
  }
  const input = JSON.parse(toolCall.function.arguments) as { label: string; confidence: "high" | "medium" | "low" };
  return { label: input.label ?? "", confidence: input.confidence ?? "low" };
}

export interface ChoiceForCompare {
  label: string;
  image?: ImageInput;
}

// 공개 시점에 두 선택을 직접 비교한다. 둘 다 그리드에서 고른 경우(이미지 없음)는
// 이 함수를 부를 필요 없이 item_id 동등 비교로 충분하다 — 이 함수는 사진이 하나라도
// 끼어 있을 때만 호출된다.
export async function compareChoices(left: ChoiceForCompare, right: ChoiceForCompare): Promise<boolean> {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text:
        `A: ${left.label}${left.image ? " (사진 첨부)" : ""}\n` +
        `B: ${right.label}${right.image ? " (사진 첨부)" : ""}\n\n` +
        "A와 B가 같은 종류의 물건이야? (예: 둘 다 감자칩이면 같은 것, 감자칩과 초콜릿이면 다른 것)",
    },
  ];
  if (left.image) content.push({ type: "image_url", image_url: { url: `data:${left.image.mediaType};base64,${left.image.imageBase64}` } });
  if (right.image) content.push({ type: "image_url", image_url: { url: `data:${right.image.mediaType};base64,${right.image.imageBase64}` } });

  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    max_tokens: 64,
    messages: [
      {
        role: "system",
        content:
          "너는 아이 둘이 각자 고른 물건(설명 텍스트 또는 사진)이 같은 종류인지 비교하는 심판이다. " +
          "정확히 똑같은 제품일 필요는 없고, 같은 종류/카테고리면 같은 것으로 판단한다.",
      },
      { role: "user", content },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "judge_match",
          description: "두 선택이 같은 종류의 물건인지 판단한다.",
          parameters: {
            type: "object",
            properties: { matched: { type: "boolean" } },
            required: ["matched"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "judge_match" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") return false;
  const input = JSON.parse(toolCall.function.arguments) as { matched: boolean };
  return !!input.matched;
}

export interface ObservationChildStat {
  name: string;
  concedeCount: number;
  concedeRatePct: number;
}

// 관찰 요약/우선순위 제안 두 프롬프트가 공유하는 핵심 원칙. "소아 전문 AI"처럼 다른 모델을 쓰거나
// 파인튜닝하는 게 아니라 — 같은 범용 모델에 아동 발달 커뮤니케이션에서 흔히 쓰이는 원칙을
// 프롬프트 레벨로 더 깊게 반영한 것뿐이다(비교 금지=Faber&Mazlish의 형제 비교 회피, 행동과
// 정체성 분리=Dweck의 성장 마인드셋 칭찬 원칙, 제안형 어투=Deci&Ryan의 자율성 지지 커뮤니케이션).
// "전문가 AI"라고 이름 붙이거나 마케팅하지 않는다 — 실제보다 큰 권위를 부여하면 기존 디스클레이머
// ("이건 심리 평가가 아니에요") 원칙과 충돌한다.
const CHILD_LANGUAGE_PRINCIPLES = [
  "'심리 분석', '정상범위', '진단', '장애', '치료가 필요합니다', '개입이 필요합니다' 같은 임상적·진단적 표현을 절대 쓰지 않는다.",
  "두 아이를 비교해서 우열을 나타내지 않는다('OO가 더 착해요', 'OO는 양보를 잘 못해요' 같은 표현 금지) — 각자의 행동 빈도만 따로, 사실 그대로 말한다.",
  "아이의 성격이나 정체성을 규정하지 않는다('이기적이다', '소극적이다', '착하다' 등) — '양보했다'는 그 순간의 행동일 뿐, 그 아이가 어떤 사람인지에 대한 판단이 아니라는 걸 항상 구분한다.",
  "해석·조언·훈육을 하지 않는다. 오직 빈도와 사실만 담백하게 전달하고, 판단은 항상 가족의 몫으로 남긴다.",
  "초등 저학년도 이해할 수 있는 쉽고 짧은 단어만 쓴다.",
  "이 데이터는 가족 앱에서 나온 몇 번의 놀이 선택 기록일 뿐이라는 한계를 벗어나는 결론을 내리지 않는다.",
];

// Phase 2 "AI 패턴 관찰 리포트" — CLAUDE.md에 확정된 8원칙(진단 언어 금지, 성격 라벨링 금지 등)을
// 시스템 프롬프트에 명시적 제약으로 강제한다. 입력은 이미 집계된 숫자뿐이다 — 자녀가 실제로
// 뭘 골랐는지(item/label) 같은 원본 내용은 절대 넘기지 않는다(빈도·추세만 다루게 하기 위함).
// 호출은 부모가 버튼을 눌렀을 때만(명시적 트리거) 일어난다 — 이 함수 자체는 자동 실행되지 않는다.
export async function generateObservationSummary(params: {
  windowLabel: string;
  totalConceded: number;
  children: ObservationChildStat[];
}): Promise<string> {
  const { windowLabel, totalConceded, children } = params;
  const lines = children
    .map((c) => `- ${c.name}: ${windowLabel} 동안 총 ${totalConceded}번의 조율 중 ${c.concedeCount}번 양보 (${c.concedeRatePct}%)`)
    .join("\n");

  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: [
          "너는 부모에게 자녀들의 놀이/선택 조율 기록을 요약해주는 도우미다. 아래 원칙을 반드시 지켜라.",
          ...CHILD_LANGUAGE_PRINCIPLES.map((p, i) => `${i + 1}. ${p}`),
          `${CHILD_LANGUAGE_PRINCIPLES.length + 1}. 한국어로 3~4문장으로 쓴다.`,
        ].join("\n"),
      },
      {
        role: "user",
        content: `기간: ${windowLabel}\n${lines}\n\n위 수치를 사실 나열 위주의 짧은 관찰 요약으로 정리해줘.`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "write_summary",
          description: "관찰 요약 텍스트를 작성한다.",
          parameters: {
            type: "object",
            properties: { summary: { type: "string", description: "3~4문장의 한국어 관찰 요약." } },
            required: ["summary"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "write_summary" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") return "";
  const input = JSON.parse(toolCall.function.arguments) as { summary: string };
  return input.summary ?? "";
}

// "이번엔 누구에게 우선권을 주면 좋을지" 제안. 위 관찰 요약과 같은 안전장치를 쓰되,
// 공정성 판단(누구를 제안할지)은 AI가 아니라 호출하는 쪽(코드)이 이미 계산해서 넘긴다 —
// 이 함수는 그 결정을 부드러운 한국어 문장으로 표현하는 역할만 한다.
export async function generateStartPrioritySuggestion(params: {
  windowLabel: string;
  suggestedChildName: string | null; // null이면 둘이 비슷함
  children: { name: string; concedeCount: number }[];
}): Promise<string> {
  const { windowLabel, suggestedChildName, children } = params;
  const lines = children.map((c) => `- ${c.name}: ${windowLabel} 동안 ${c.concedeCount}번 양보함`).join("\n");
  const conclusion = suggestedChildName
    ? `이 수치를 근거로 이번엔 ${suggestedChildName}에게 먼저 고를 기회를 주자고 부드럽게 제안해줘.`
    : "두 아이의 수치가 비슷하니, 굳이 한쪽을 정하지 말고 비슷하다는 걸 담백하게 말해줘.";

  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: [
          "너는 아이 둘이 있는 가족에게 '이번엔 누가 먼저 고르면 좋을지' 부드럽게 제안해주는 도우미다. 아래 원칙을 반드시 지켜라.",
          ...CHILD_LANGUAGE_PRINCIPLES.map((p, i) => `${i + 1}. ${p}`),
          `${CHILD_LANGUAGE_PRINCIPLES.length + 1}. 명령이 아니라 제안으로 말한다. '~해야 해', '~하세요' 같은 명령형 대신 '~는 어때?' 같은 제안형만 쓴다 — 아이가 스스로 결정한다고 느끼게 한다.`,
          `${CHILD_LANGUAGE_PRINCIPLES.length + 2}. 한국어로 2~3문장, 짧고 다정하게 쓴다. 이모지는 쓰지 않는다.`,
        ].join("\n"),
      },
      {
        role: "user",
        content: `기간: ${windowLabel}\n${lines}\n\n${conclusion}`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "suggest_priority",
          description: "이번엔 누구에게 먼저 고를 기회를 주면 좋을지 제안 문장을 작성한다.",
          parameters: {
            type: "object",
            properties: { suggestion: { type: "string", description: "2~3문장의 한국어 제안 문장." } },
            required: ["suggestion"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "suggest_priority" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") return "";
  const input = JSON.parse(toolCall.function.arguments) as { suggestion: string };
  return input.suggestion ?? "";
}
