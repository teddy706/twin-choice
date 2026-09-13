import { describe, expect, it } from "vitest";
import { containsBannedLanguage } from "./observationSafety";

describe("containsBannedLanguage", () => {
  it("flags clinical/diagnostic phrasing", () => {
    expect(containsBannedLanguage("이건 심리 분석이 아니에요")).toBe(true);
    expect(containsBannedLanguage("정상범위를 벗어났어요")).toBe(true);
    expect(containsBannedLanguage("전문가 개입이 필요합니다")).toBe(true);
  });

  it("flags sibling comparison / trait-labeling phrasing", () => {
    expect(containsBannedLanguage("동생이 형보다 더 착해요")).toBe(true);
    expect(containsBannedLanguage("이 아이는 소극적이에요")).toBe(true);
  });

  it("allows plain factual observation sentences", () => {
    expect(containsBannedLanguage("OO는 최근 2주 동안 4번의 조율 중 4번을 양보했습니다.")).toBe(false);
  });

  it("does not flag unrelated text", () => {
    expect(containsBannedLanguage("오늘은 룰렛으로 정했어요")).toBe(false);
  });
});
