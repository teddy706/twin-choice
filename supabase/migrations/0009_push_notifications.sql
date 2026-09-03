-- Phase 2 5번: 푸시 알림. 각 기기의 Web Push 구독 정보를 저장한다.
-- 실제 발송은 서버(app/api/push/notify)에서 서비스 롤로 대상 프로필들의 구독을 모아
-- web-push 라이브러리로 보낸다 — 클라이언트가 다른 사람의 구독 정보를 읽을 필요/권한은 없다.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_profile_idx on push_subscriptions(profile_id);

alter table push_subscriptions enable row level security;

-- 같은 기기(브라우저)를 형제가 돌려쓰는 가족 공용 기기 시나리오를 고려해 endpoint 는 전역 유니크로 두고,
-- 새로 구독하는 사람이 그 기기의 구독을 "가져간다"(upsert on endpoint) — 지금 그 기기를 쓰는
-- 사람에게 알림이 가는 게 맞는 동작이다.
create policy push_subscriptions_select on push_subscriptions
  for select using (profile_id = public.my_profile_id());

create policy push_subscriptions_insert on push_subscriptions
  for insert with check (
    profile_id = public.my_profile_id()
    and family_id = public.my_family_id()
  );

-- USING 은 family 스코프로 넓게 둔다(형제가 같은 기기의 구독 row를 "이어받을" 수 있어야 함),
-- WITH CHECK 은 profile_id 를 항상 본인으로 강제한다(남의 구독을 다른 사람 걸로 바꿔치기는 불가).
create policy push_subscriptions_update on push_subscriptions
  for update using (family_id = public.my_family_id())
  with check (profile_id = public.my_profile_id() and family_id = public.my_family_id());

create policy push_subscriptions_delete on push_subscriptions
  for delete using (profile_id = public.my_profile_id());
