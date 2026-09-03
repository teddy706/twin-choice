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
