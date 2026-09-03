-- "사진으로 고르기"를 고정 항목 매칭에서 자유 비교 방식으로 전환한다.
-- 이제 선택은 (a) 그리드에서 고른 item_id, 또는 (b) 사진+라벨(AI가 설명하거나 아이가 직접 입력) 중 하나다.
-- 공개 시점에 둘 다 item_id면 그대로 비교하고, 하나라도 사진/라벨 기반이면 AI가 사진(들)을 직접 비교해
-- rounds.ai_matched 에 결과를 캐싱한다(두 아이가 각자 다시 계산하지 않도록).

alter table choices alter column item_id drop not null;
alter table choices add column label text;
alter table choices add column photo_id uuid references photos(id) on delete set null;
alter table choices add constraint choices_item_or_label check (item_id is not null or label is not null);

alter table rounds add column ai_matched boolean;

-- 블라인드 원칙 누락분 수정: photos 도 choices 와 동일하게, 라운드가 공개되기 전에는
-- 본인 사진만 보이고 상대 사진은 안 보여야 한다. 기존 정책은 family_id 스코프만 걸려 있어
-- "사진으로 고르기"를 쓰면 상대가 미리 사진을 볼 수 있는 구멍이 있었다.
drop policy if exists photos_select on photos;
create policy photos_select on photos
  for select using (
    profile_id = public.my_profile_id()
    or exists (
      select 1 from rounds r
      where r.id = photos.round_id
        and r.family_id = public.my_family_id()
        and r.status <> 'waiting'
    )
  );

-- AI 비교 결과를 캐싱하기 위해, 공개된(revealed) 라운드에 한해 family 구성원이 이 컬럼을 채울 수 있게 한다.
-- waiting/resolved 라운드는 수정 불가 — 블라인드 유지 중이거나 이미 끝난 라운드를 건드릴 이유가 없다.
create policy rounds_update_ai_matched on rounds
  for update using (family_id = public.my_family_id() and status = 'revealed')
  with check (family_id = public.my_family_id() and status = 'revealed');
