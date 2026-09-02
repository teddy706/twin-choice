-- 따로 또 같이 — Phase 1 스키마
-- 모든 테이블은 family_id (또는 family_id로 조인 가능한 부모 테이블)를 갖는다.
-- "가족은 하나뿐" 가정을 코드에 심지 않기 위해 family_id 기반으로 전부 스코프한다.

create extension if not exists "pgcrypto";

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 가족',
  -- 자녀 로그인 화면에서 "어느 가족인지" 특정하기 위한 짧은 코드(이메일이 없으므로 필요).
  -- 부모 회원가입 시 서버에서 발급한다.
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- profiles.user_id 는 auth.users 로 매핑된다. 부모/자녀 모두 실제 Supabase Auth 세션을 가지며
-- (자녀는 PIN으로 로그인하지만 내부적으로는 synthetic email/password 기반 세션을 발급받는다),
-- 그 결과 RLS 정책에서 auth.uid() 를 그대로 사용할 수 있다.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  name text not null,
  avatar text not null default '🧒',
  pin_hash text,
  created_at timestamptz not null default now()
);
create index profiles_family_id_idx on profiles(family_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  emoji text not null default '📦',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_family_id_idx on categories(family_id);

create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  emoji text not null default '⭐',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index items_category_id_idx on items(category_id);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  category_id uuid not null references categories(id),
  -- 부모가 자녀 데이터를 전체 삭제할 때 라운드 구조 자체는 남기고 "누가 시작했는지"만 지운다.
  started_by uuid references profiles(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'revealed', 'resolved')),
  -- 라운드 생성 시점에 family 의 활성 자녀 프로필 수로 고정된다.
  -- 이 인원 수만큼 choices 가 모이면 트리거가 자동으로 'revealed' 로 전환한다.
  expected_participants int not null default 2,
  created_at timestamptz not null default now()
);
create index rounds_family_id_idx on rounds(family_id);
create index rounds_status_idx on rounds(family_id, status);

create table choices (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  -- 자녀 프로필이 삭제되면 그 자녀가 남긴 선택 기록도 함께 지운다("자녀 데이터 전체 삭제").
  profile_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references items(id),
  submitted_at timestamptz not null default now(),
  unique (round_id, profile_id)
);
create index choices_round_id_idx on choices(round_id);

create table resolutions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null unique references rounds(id) on delete cascade,
  -- 'match' 는 둘이 같은 항목을 골라 조율 도구가 필요 없던 경우를 기록한다.
  type text not null check (type in ('roulette', 'turn', 'both', 'manual', 'match')),
  winner_profile_id uuid references profiles(id) on delete set null,
  conceded_profile_id uuid references profiles(id) on delete set null,
  resolved_at timestamptz not null default now()
);

-- 카테고리별 "번갈아하기" 마지막 승자를 기억하기 위한 보조 테이블.
-- PRD/원본 프로토타입의 turn-taking 로직을 서버 상태로 이관한 것.
create table turn_state (
  family_id uuid not null references families(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  last_winner_profile_id uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (family_id, category_id)
);

-- Phase 2에서 연결할 사진 업로드+AI 분류용 스키마. Phase 1에서는 테이블만 존재.
create table photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  round_id uuid references rounds(id),
  item_id uuid references items(id),
  storage_path text not null,
  ai_category text,
  ai_label text,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
create index photos_family_id_idx on photos(family_id);
