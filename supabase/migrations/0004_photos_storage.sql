-- "사진으로 고르기" 를 위한 비공개 스토리지 버킷.
-- 경로 규칙: {family_id}/{profile_id}/{round_id}-{timestamp}.jpg
-- storage.foldername(name) 의 첫 세그먼트를 family_id 로 취급해 RLS를 건다.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy photos_storage_select on storage.objects
  for select using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.my_family_id()::text
  );

create policy photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.my_family_id()::text
    and (storage.foldername(name))[2] = public.my_profile_id()::text
  );
