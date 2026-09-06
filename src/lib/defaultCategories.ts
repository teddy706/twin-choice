// 신규 가족 생성 시 기본으로 시딩하는 카테고리/항목.
// reference/twin-choice-app.html 의 DEFAULT_SETTINGS 를 그대로 옮겼다.
export const DEFAULT_CATEGORIES = [
  {
    name: "영상",
    emoji: "🎬",
    items: [
      { name: "만화", emoji: "📺" },
      { name: "동물영상", emoji: "🐶" },
      { name: "챌린지", emoji: "🎤" },
      { name: "브이로그", emoji: "📹" },
      { name: "게임영상", emoji: "🎮" },
    ],
  },
  {
    name: "과자",
    emoji: "🍪",
    items: [
      { name: "초코과자", emoji: "🍫" },
      { name: "감자칩", emoji: "🥔" },
      { name: "젤리", emoji: "🍬" },
      { name: "사탕", emoji: "🍭" },
      { name: "과일", emoji: "🍓" },
    ],
  },
  {
    name: "장난감",
    emoji: "🧸",
    items: [
      { name: "레고", emoji: "🧱" },
      { name: "인형", emoji: "🪆" },
      { name: "보드게임", emoji: "🎲" },
      { name: "그림도구", emoji: "🎨" },
      { name: "블록", emoji: "🟦" },
    ],
  },
  {
    name: "놀이",
    emoji: "⚽",
    items: [
      { name: "보드게임", emoji: "🎲" },
      { name: "줄넘기", emoji: "🪢" },
      { name: "그림그리기", emoji: "🖍️" },
      { name: "술래잡기", emoji: "🏃" },
      { name: "만들기", emoji: "✂️" },
    ],
  },
  {
    name: "옷 고르기",
    emoji: "👕",
    items: [
      { name: "티셔츠", emoji: "👕" },
      { name: "바지", emoji: "👖" },
      { name: "원피스", emoji: "👗" },
      { name: "모자", emoji: "🧢" },
      { name: "신발", emoji: "👟" },
    ],
  },
  {
    name: "음식 고르기",
    emoji: "🍔",
    items: [
      { name: "피자", emoji: "🍕" },
      { name: "치킨", emoji: "🍗" },
      { name: "김밥", emoji: "🍙" },
      { name: "라면", emoji: "🍜" },
      { name: "햄버거", emoji: "🍔" },
    ],
  },
] as const;
