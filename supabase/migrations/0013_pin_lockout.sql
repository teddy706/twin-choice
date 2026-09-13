-- 자녀 PIN 브루트포스 방지. 4자리 PIN은 경우의 수가 10000개뿐이라 시도 횟수 제한이 없으면
-- /api/auth/child-login 을 반복 호출해 무차별 대입이 가능하다.
-- 5회 연속 실패 시 1분 잠금(src/lib/childAuth.ts의 PIN_MAX_ATTEMPTS/PIN_LOCK_DURATION_MS).
-- 이 두 컬럼은 child-login 라우트가 service role(admin 클라이언트)로만 갱신한다 —
-- RLS를 우회하는 서버 전용 경로라 별도 정책/컬럼 GRANT가 필요 없다.

alter table profiles add column pin_fail_count int not null default 0;
alter table profiles add column pin_locked_until timestamptz;
