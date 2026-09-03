-- 자녀 프로필을 실제 사진으로 꾸밀 수 있게 한다("아이들 사진 업로드"). 이모지 아바타는 그대로 두고
-- avatar_photo_path 가 있으면 그 사진을, 없으면 이모지를 보여주는 방식(폴백)으로 UI에서 처리한다.

alter table profiles add column avatar_photo_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- 경로 규칙: {family_id}/{profile_id}.jpg — 프로필당 한 장, 다시 올리면 덮어쓴다(upsert).
-- "사진으로 고르기"의 choices/photos와 달리 블라인드 대상이 아니다(선택 내용이 아니라
-- "이 사람이 누구인지" 식별용 프로필 사진) — family 구성원이면 항상 서로 볼 수 있다.
create policy avatars_storage_select on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.my_family_id()::text
  );

create policy avatars_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and public.my_role() = 'parent'
    and (storage.foldername(name))[1] = public.my_family_id()::text
  );

create policy avatars_storage_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and public.my_role() = 'parent'
    and (storage.foldername(name))[1] = public.my_family_id()::text
  )
  with check (
    bucket_id = 'avatars'
    and public.my_role() = 'parent'
    and (storage.foldername(name))[1] = public.my_family_id()::text
  );

-- profiles 는 지금까지 클라이언트 UPDATE 정책이 전혀 없었다(자녀 프로비저닝은 전부 서비스 롤 경유).
-- 아바타 사진 연결을 위해 처음으로 하나 연다 — 부모만, 같은 family만, 그리고 컬럼 단위 권한으로
-- avatar/avatar_photo_path 두 필드만 건드릴 수 있게 좁힌다(role/pin_hash/family_id 는 여전히
-- 서비스 롤 전용 경로로만 바뀔 수 있음 — RLS만으로는 행 단위까지만 막을 수 있어서 컬럼 GRANT로 보강).
create policy profiles_update_avatar on profiles
  for update using (
    family_id = public.my_family_id()
    and public.my_role() = 'parent'
  )
  with check (
    family_id = public.my_family_id()
    and public.my_role() = 'parent'
  );

revoke update on profiles from authenticated;
grant update (avatar, avatar_photo_path) on profiles to authenticated;
