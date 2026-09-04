-- 버그 수정: 두 자녀가 거의 동시에 같은 카테고리로 "새로운 선택 시작하기"를 누르면
-- rounds row가 중복으로 생성돼서 각자 서로 다른 라운드에 혼자 남고, 상대는 영원히 안 오는
-- 문제가 있었다(CategoryPicker.startRound()는 기존 대기 라운드 확인 없이 무조건 insert했음).
-- 앱 레벨의 "확인 후 삽입"은 그 자체로 레이스가 있으므로, family_id+category_id 조합으로
-- "대기 중(waiting)"인 라운드는 항상 하나만 존재하도록 부분 유니크 인덱스로 DB가 직접 막는다.
-- 라운드가 revealed/resolved로 넘어가면 이 인덱스 대상에서 빠지므로, 같은 카테고리로
-- 다시 새 라운드를 시작하는 건 평소처럼 계속 가능하다.
create unique index rounds_one_waiting_per_category
  on rounds (family_id, category_id)
  where status = 'waiting';
