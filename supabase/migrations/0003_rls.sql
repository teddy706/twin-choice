-- RLS 정책
--
-- 설계 원칙:
-- * "프로비저닝"(가족 생성, 부모/자녀 계정 생성, 카테고리 시딩, 자녀 데이터 삭제)은
--   전부 서버(app/api/**)에서 SUPABASE_SERVICE_ROLE_KEY 로 실행하며 RLS를 우회한다.
--   이 키는 절대 브라우저로 내려가지 않는다.
-- * 앱 런타임 동작(선택 제출, 라운드 조회, 기록 조회 등)은 브라우저가 로그인 세션(anon key)으로
--   직접 Supabase 를 호출하며, 아래 RLS 정책이 유일한 방어선이다.
-- * 블라인드 유지는 choices SELECT 정책에서 DB 레벨로 강제한다 (앱 코드가 숨기는 게 아님).

alter table families enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
alter table rounds enable row level security;
alter table choices enable row level security;
alter table resolutions enable row level security;
alter table turn_state enable row level security;
alter table photos enable row level security;

-- families: 내 가족 row만 조회
create policy families_select on families
  for select using (id = public.my_family_id());

-- profiles: 같은 가족 구성원만 조회. 쓰기는 서버(service role)에서만.
create policy profiles_select on profiles
  for select using (family_id = public.my_family_id());

-- categories / items: 같은 가족 것만 조회 (Phase 1은 커스터마이징 미지원 -> 클라이언트 쓰기 정책 없음)
create policy categories_select on categories
  for select using (family_id = public.my_family_id());

create policy items_select on items
  for select using (
    exists (
      select 1 from categories c
      where c.id = items.category_id and c.family_id = public.my_family_id()
    )
  );

-- rounds: 같은 가족이면 조회 가능, 부모/자녀 누구나 새 라운드를 시작할 수 있음.
-- status 전환은 트리거(SECURITY DEFINER)만 수행 -> 클라이언트 UPDATE 정책은 두지 않는다(기본 거부).
create policy rounds_select on rounds
  for select using (family_id = public.my_family_id());

create policy rounds_insert on rounds
  for insert with check (
    family_id = public.my_family_id()
    and started_by = public.my_profile_id()
  );

-- choices: 핵심 블라인드 규칙.
-- 내 선택은 항상 보이고, 상대 선택은 라운드가 'waiting' 을 벗어난 뒤에만 보인다.
create policy choices_select on choices
  for select using (
    profile_id = public.my_profile_id()
    or exists (
      select 1 from rounds r
      where r.id = choices.round_id
        and r.family_id = public.my_family_id()
        and r.status <> 'waiting'
    )
  );

-- 블라인드 선택은 자녀만 제출한다(부모는 라운드를 시작/관전만 가능).
-- expected_participants 도 child 프로필 수만 세므로 이 제약이 없으면 부모의 선택이
-- 자녀 두 명의 비교를 어긋나게 만들 수 있다.
create policy choices_insert on choices
  for insert with check (
    profile_id = public.my_profile_id()
    and public.my_role() = 'child'
    and exists (
      select 1 from rounds r
      where r.id = choices.round_id
        and r.family_id = public.my_family_id()
        and r.status = 'waiting'
    )
  );

-- resolutions: 공개된(=매치 여부가 드러난) 라운드에 한해 조회/기록 가능
create policy resolutions_select on resolutions
  for select using (
    exists (
      select 1 from rounds r
      where r.id = resolutions.round_id and r.family_id = public.my_family_id()
    )
  );

create policy resolutions_insert on resolutions
  for insert with check (
    exists (
      select 1 from rounds r
      where r.id = resolutions.round_id
        and r.family_id = public.my_family_id()
        and r.status = 'revealed'
    )
  );

-- turn_state: 번갈아하기 마지막 승자 기록. 같은 가족이면 읽고 갱신 가능(upsert).
create policy turn_state_select on turn_state
  for select using (family_id = public.my_family_id());

create policy turn_state_insert on turn_state
  for insert with check (family_id = public.my_family_id());

create policy turn_state_update on turn_state
  for update using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());

-- photos: 스키마만 존재(Phase 2에서 기능 연결). 최소한의 가족 스코프 정책만 미리 걸어둔다.
create policy photos_select on photos
  for select using (family_id = public.my_family_id());

create policy photos_insert on photos
  for insert with check (
    family_id = public.my_family_id()
    and profile_id = public.my_profile_id()
  );
