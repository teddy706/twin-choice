import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// "사진으로 고르기": 자유 서술형 사진 비교 대신, 이미 정해진 카테고리 항목 목록 중
// 하나로만 매칭시킨다. 그래야 조율/기록/블라인드 로직을 전혀 바꾸지 않고
// "탭하기"를 "사진 찍기"로 바꾸는 것만으로 끝난다. AI 호출은 사진을 찍는(=버튼을 누르는)
// 그 순간에만 일어나고, 자동/백그라운드 호출은 없다.

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface ClassifyCandidate {
  id: string;
  name: string;
  emoji: string;
}

export interface ClassifyResult {
  matchedItemId: string | null;
  label: string;
}

export async function classifyPhotoAgainstItems(params: {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  categoryName: string;
  candidates: ClassifyCandidate[];
}): Promise<ClassifyResult> {
  const { imageBase64, mediaType, categoryName, candidates } = params;

  const list = candidates.map((c, i) => `${i}: ${c.emoji} ${c.name}`).join("\n");

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system:
      "너는 아이가 찍은 사물 사진을 미리 정해진 후보 목록 중 하나와 매칭시키는 분류기다. " +
      "사람이 사진에 있어도 사람에 대해서는 언급하지 말고 사물만 본다. " +
      "후보 중 뚜렷하게 일치하는 게 없으면 반드시 match_index 를 -1 로 응답한다(억지로 끼워맞추지 않는다).",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text: `카테고리: ${categoryName}\n후보 목록:\n${list}\n\n이 사진은 후보 중 몇 번에 가장 가까워?`,
          },
        ],
      },
    ],
    tools: [
      {
        name: "pick_item",
        description: "사진과 가장 잘 맞는 후보 항목을 고른다.",
        input_schema: {
          type: "object",
          properties: {
            match_index: {
              type: "integer",
              description: "후보 목록의 인덱스(0부터 시작). 뚜렷하게 맞는 게 없으면 -1.",
            },
            label: {
              type: "string",
              description: "사진 속 사물을 짧게 한국어로 설명(예: '감자칩 한 봉지').",
            },
          },
          required: ["match_index", "label"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "pick_item" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { matchedItemId: null, label: "" };
  }

  const input = toolUse.input as { match_index: number; label: string };
  const matched = candidates[input.match_index];
  return { matchedItemId: matched ? matched.id : null, label: input.label ?? "" };
}
