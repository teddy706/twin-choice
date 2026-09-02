-- 헬퍼 함수: 현재 로그인한 auth.uid() 를 profiles 로 매핑한다.
-- security definer + search_path 고정으로, RLS 정책 안에서 profiles 를 다시 조회할 때
-- 무한 재귀(RLS가 RLS를 부르는 상황)를 피한다. Supabase 공식 권장 패턴.

create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where user_id = auth.uid() limit 1
$$;

-- 라운드 생성 시 expected_participants 를 family 의 활성 자녀 수로 고정한다.
create or replace function public.set_round_expected_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select greatest(count(*), 2) into new.expected_participants
  from profiles
  where family_id = new.family_id and role = 'child';
  return new;
end;
$$;

create trigger rounds_set_expected_participants
before insert on rounds
for each row execute function public.set_round_expected_participants();

-- 두 번째(혹은 family 의 마지막) choice 가 들어오는 순간 라운드를 동시 공개 상태로 전환한다.
-- 이 시점 전까지는 choices RLS SELECT 정책이 상대방 row 를 감춘다 (블라인드 유지).
create or replace function public.maybe_reveal_round()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  submitted_count int;
  needed int;
begin
  select count(*) into submitted_count from choices where round_id = new.round_id;
  select expected_participants into needed from rounds where id = new.round_id;

  if submitted_count >= needed then
    update rounds set status = 'revealed' where id = new.round_id and status = 'waiting';
  end if;

  return new;
end;
$$;

create trigger choices_maybe_reveal
after insert on choices
for each row execute function public.maybe_reveal_round();

-- resolution 이 기록되면 라운드를 종결 상태로 전환한다.
create or replace function public.resolve_round()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update rounds set status = 'resolved' where id = new.round_id;
  return new;
end;
$$;

create trigger resolutions_resolve_round
after insert on resolutions
for each row execute function public.resolve_round();
