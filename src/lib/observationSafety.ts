import "server-only";

// CLAUDE.md 원칙 8: "출력에 금지된 표현이 섞이지 않는지 확인하는 절차가 필요하다."
// 프롬프트로 금지시켜도 모델이 실수할 수 있으니, 내보내기 전에 마지막으로 한 번 더 걸러낸다.
const BANNED_PATTERNS = [
  "심리 분석",
  "심리분석",
  "정상범위",
  "정상 범위",
  "비정상",
  "진단",
  "장애",
  "병리",
  "증상",
  "치료가 필요",
  "치료 필요",
  "개입이 필요",
  "전문가 개입",
  "상담이 필요",
];

export function containsBannedLanguage(text: string): boolean {
  return BANNED_PATTERNS.some((p) => text.includes(p));
}
