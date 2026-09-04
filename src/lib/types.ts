export type Role = "parent" | "child";
export type RoundStatus = "waiting" | "revealed" | "resolved";
export type ResolutionType = "roulette" | "turn" | "both" | "manual" | "match";

export interface Family {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  family_id: string;
  user_id: string | null;
  role: Role;
  name: string;
  avatar: string;
  // 실제 프로필 사진(있으면 이 사진을, 없으면 avatar 이모지를 보여준다 — UI에서 폴백 처리).
  avatar_photo_path: string | null;
  pin_hash: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  family_id: string;
  name: string;
  emoji: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Item {
  id: string;
  category_id: string;
  name: string;
  emoji: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Round {
  id: string;
  family_id: string;
  category_id: string;
  started_by: string | null;
  status: RoundStatus;
  expected_participants: number;
  // 공개된 라운드에서 두 선택이 사진/자유 라벨 기반이라 AI 비교가 필요했던 경우의 캐싱된 결과.
  // 둘 다 그리드 항목이면 계산할 필요 없이 null로 남아 있어도 되고(클라이언트가 item_id로 바로 비교),
  // AI 비교를 한 번 거쳤다면 true/false 로 고정된다.
  ai_matched: boolean | null;
  created_at: string;
}

export interface Choice {
  id: string;
  round_id: string;
  profile_id: string;
  // 그리드에서 고른 경우 item_id, 사진/자유 입력으로 고른 경우 label(+photo_id) — 최소 하나는 있어야 한다.
  item_id: string | null;
  label: string | null;
  photo_id: string | null;
  reason: string | null; // "왜 이게 좋아?" 음성을 텍스트로 바꾼 것(선택 사항, 오디오 자체는 저장 안 함)
  submitted_at: string;
}

export interface Resolution {
  id: string;
  round_id: string;
  type: ResolutionType;
  winner_profile_id: string | null;
  conceded_profile_id: string | null;
  resolved_at: string;
}

export interface TurnState {
  family_id: string;
  category_id: string;
  last_winner_profile_id: string | null;
  updated_at: string;
}

export interface Photo {
  id: string;
  family_id: string;
  profile_id: string;
  round_id: string | null;
  item_id: string | null;
  storage_path: string;
  ai_category: string | null;
  ai_label: string | null;
  confirmed: boolean;
  created_at: string;
}

// supabase-js 의 제네릭 인자로 쓰기 위한 최소 Database 타입.
// `supabase gen types typescript`로 나중에 정식 생성본으로 교체할 수 있다.
export interface Database {
  public: {
    Tables: {
      families: { Row: Family; Insert: Partial<Family>; Update: Partial<Family> };
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> };
      items: { Row: Item; Insert: Partial<Item>; Update: Partial<Item> };
      rounds: { Row: Round; Insert: Partial<Round>; Update: Partial<Round> };
      choices: { Row: Choice; Insert: Partial<Choice>; Update: Partial<Choice> };
      resolutions: { Row: Resolution; Insert: Partial<Resolution>; Update: Partial<Resolution> };
      turn_state: { Row: TurnState; Insert: Partial<TurnState>; Update: Partial<TurnState> };
      photos: { Row: Photo; Insert: Partial<Photo>; Update: Partial<Photo> };
    };
  };
}

// 자녀 화면에 절대 내려주면 안 되는 필드들의 표식(코드 리뷰/그렙 편의를 위한 문서용 타입).
// 실제 차단은 컴포넌트 마운트 자체를 스킵하는 방식으로 이뤄진다 (src/app 참고).
export type ParentOnlyStat = never;
