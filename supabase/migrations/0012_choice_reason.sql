-- "왜 이게 좋아?" 음성으로 남긴 이유(텍스트로 변환된 것만 저장, 오디오 자체는 저장하지 않음).
-- choices는 지금 UPDATE 정책이 전혀 없다(SELECT/INSERT만 존재, 기본 거부) — 본인 소유 선택에
-- 한해 reason 컬럼만 고칠 수 있게 새로 연다. item_id/label/photo_id는 제출 후 못 바꾸게
-- 컬럼 단위 GRANT로 막는다(0008_child_avatar_photos.sql의 profiles avatar 패턴과 동일).

alter table choices add column reason text;

create policy choices_update on choices
  for update using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id());

revoke update on choices from authenticated;
grant update (reason) on choices to authenticated;
