-- 버그 수정: choices/resolutions 에 Postgres Changes(Realtime) 복제가 한 번도 켜져 있지 않았다.
-- src/components/RoundView.tsx 가 이 두 테이블을 postgres_changes로 구독하고 있었지만, 테이블을
-- supabase_realtime publication에 추가한 적이 없어서 이벤트가 전혀 오지 않았고(직접 채널을 열어
-- INSERT를 날려 확인함), 결과적으로 3초 폴링 폴백 하나로만 동작하고 있었다 — 두 폰의 폴링 타이머가
-- 각자 독립적으로 도는 데다 화면이 잠기면 브라우저가 그 타이머까지 스로틀링해서 "상대방 반응이
-- 타이밍이 안 맞는" 증상으로 나타났다.
alter publication supabase_realtime add table choices, resolutions;
