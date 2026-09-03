-- Phase 2: 카테고리/항목 커스터마이징. 부모가 직접 추가/soft-delete 할 수 있게
-- categories/items 에 대한 INSERT/UPDATE RLS를 연다(그동안은 회원가입 시 서버가 시딩만 했음).
-- 자녀는 여전히 SELECT만 가능(기존 categories_select/items_select 정책 유지) — 커스터마이징은 부모 전용.

create policy categories_insert on categories
  for insert with check (
    family_id = public.my_family_id()
    and public.my_role() = 'parent'
  );

create policy categories_update on categories
  for update using (
    family_id = public.my_family_id()
    and public.my_role() = 'parent'
  )
  with check (
    family_id = public.my_family_id()
    and public.my_role() = 'parent'
  );

create policy items_insert on items
  for insert with check (
    public.my_role() = 'parent'
    and exists (
      select 1 from categories c
      where c.id = items.category_id and c.family_id = public.my_family_id()
    )
  );

create policy items_update on items
  for update using (
    public.my_role() = 'parent'
    and exists (
      select 1 from categories c
      where c.id = items.category_id and c.family_id = public.my_family_id()
    )
  )
  with check (
    public.my_role() = 'parent'
    and exists (
      select 1 from categories c
      where c.id = items.category_id and c.family_id = public.my_family_id()
    )
  );
