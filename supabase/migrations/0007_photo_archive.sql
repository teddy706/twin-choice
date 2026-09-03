-- Phase 2: 사진 아카이브. 부모가 지난 사진들을 모아보고 라벨을 재분류/수정할 수 있게 한다.
-- 조회는 기존 photos_select 정책으로 이미 커버된다(본인 사진은 항상, 상대/부모는 라운드가
-- waiting을 벗어난 뒤에만 — 블라인드 유지). 여기서는 라벨 수정을 위한 UPDATE만 새로 연다.

create policy photos_update on photos
  for update using (
    family_id = public.my_family_id()
    and public.my_role() = 'parent'
  )
  with check (
    family_id = public.my_family_id()
    and public.my_role() = 'parent'
  );
