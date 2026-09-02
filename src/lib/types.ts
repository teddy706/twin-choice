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
  started_by: string;
  status: RoundStatus;
  expected_participants: number;
  created_at: string;
}

export interface Choice {
  id: string;
  round_id: string;
  profile_id: string;
  item_id: string;
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
