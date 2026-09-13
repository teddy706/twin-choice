# 사용자 스토리 — 따로 또 같이

**문서 버전:** v1.0
**작성일:** 2026-09-13

> 이 문서는 [PRD.md](PRD.md)의 요구사항을 실제 구현 단위(에픽/스토리)로 분해해 정리한 것이다. 모든 스토리는 **이미 구현·실제 브라우저(또는 API 직접 호출/SQL)로 검증 완료**됐다 — 상태 표시가 없는 스토리는 없다. 신규 기능을 계획할 때는 이 문서에 새 에픽/스토리를 추가하는 방식으로 갱신할 것. 각 스토리의 구현 상세·검증 내역은 저장소 루트의 [CLAUDE.md](../CLAUDE.md)를 참고.

역할 표기: **부모** = 유일한 정식 로그인 주체(이메일), **자녀** = PIN으로 전환하는 프로필(실제로는 synthetic 계정 세션).

---

## 에픽 1. 계정/인증

### US-1.1 부모 회원가입/로그인
- **As a** 부모, **I want to** 이메일/비밀번호로 가입하고 로그인, **so that** 우리 가족 공간을 만들고 계속 접근할 수 있다.
- 인수 조건: 가입 시 `families` row와 6자리 가족 코드(`join_code`)가 함께 생성된다 / 헷갈리는 문자(0/O, 1/I/L)를 뺀 알파벳으로 코드 생성
- 상태: ✅ 완료 (`/signup`, `/login/parent`, `src/lib/joinCode.ts`)

### US-1.2 자녀 프로필 생성(이름+아바타+PIN)
- **As a** 부모, **I want to** 자녀 이름·이모지 아바타·4자리 PIN으로 프로필을 만들고, **so that** 아이가 로그인 없이 본인 프로필로 들어올 수 있다.
- 인수 조건: PIN은 결정론적으로 파생된 비밀번호로 synthetic Supabase Auth 계정을 만드는 데만 쓰이고 평문 저장 안 함 / `pin_hash`는 표시/대조용으로만 별도 보관
- 상태: ✅ 완료 (`ChildrenManager.tsx`, `/api/children`, `src/lib/childAuth.ts`)

### US-1.3 자녀 로그인: 가족 코드 → 프로필 선택 → PIN
- **As a** 자녀, **I want to** 가족 코드를 입력하고 내 프로필을 고른 뒤 PIN을 입력해, **so that** 내 화면으로 들어갈 수 있다.
- 인수 조건: 마지막 입력한 가족 코드는 쿠키로 기억해 다음부터 코드 입력 생략 / 성공 시 synthetic 계정으로 실제 Supabase Auth 세션 발급
- 상태: ✅ 완료 (`/login/child`, `/api/auth/family-lookup`, `/api/auth/child-login`)

### US-1.4 PIN 확인 버튼 (자동 제출 방지)
- **As a** 자녀, **I want to** PIN 4자리를 다 누른 뒤 확인 버튼을 눌러야 진행되도록, **so that** "눌렀는데 되는 건지 안되는 건지" 헷갈리지 않는다.
- 인수 조건: 4자리 입력 즉시 자동 제출하지 않음 / 확인 버튼은 4자리 다 찼을 때만 활성화, 처리 중엔 "확인하는 중..." 표시
- 상태: ✅ 완료 (2026-09-13, 자매 앱 reading-buddy가 겪은 같은 문제를 역이식) — `src/app/login/child/page.tsx`

### US-1.5 PIN 브루트포스 방지(5회 실패 시 1분 잠금)
- **As a** 시스템, **I want to** PIN을 5회 연속 틀리면 1분간 로그인 시도를 막도록, **so that** 4자리(경우의 수 10000개) PIN 무차별 대입을 막을 수 있다.
- 인수 조건: `profiles.pin_fail_count`/`pin_locked_until` 갱신 / 잠금 중에는 올바른 PIN을 넣어도 거부 / 로그인 성공 시 카운터 리셋
- 상태: ✅ 완료 (2026-09-13, reading-buddy 역이식) — `0013_pin_lockout.sql`, `src/lib/childAuth.ts`의 `PIN_MAX_ATTEMPTS`/`PIN_LOCK_DURATION_MS`, 실제 배포 사이트에서 5회 실패→잠금→1분 후 해제까지 브라우저로 검증 완료

### US-1.6 부모 설정에서 자녀 관리
- **As a** 부모, **I want to** 자녀 프로필 이름·아바타를 수정하고 데이터를 삭제할 수 있게, **so that** 잘못 만든 프로필이나 탈퇴 요청에 대응할 수 있다.
- 인수 조건: "데이터 전체 삭제"는 되돌릴 수 없다는 확인 단계를 거침
- 상태: ✅ 완료 (`/settings/children`, `ChildrenManager.tsx`)

### US-1.7 자녀 얼굴 사진을 아바타로 사용
- **As a** 부모, **I want to** 이모지 대신 아이 얼굴 사진을 아바타로 올리고, **so that** 프로필을 더 쉽게 구분할 수 있다.
- 인수 조건: 비공개 스토리지(`avatars`) `{family_id}/{profile_id}` 경로에 upsert 저장 / 사진 없으면 이모지로 폴백 / **PIN 입력 전 "누구예요?" 프로필 선택 화면(가족 코드만 알면 도달 가능)은 의도적으로 이모지만 유지** — 실제 얼굴 사진은 PIN 로그인 이후 화면에만 노출(프라이버시)
- 상태: ✅ 완료 (`0008_child_avatar_photos.sql`, `Avatar.tsx`)

---

## 에픽 2. 블라인드 선택 → 동시 공개 → 조율

### US-2.1 카테고리 선택 후 블라인드 그리드 선택
- **As a** 자녀, **I want to** 카테고리를 고르고 목록에서 항목을 탭해 고르면, **so that** 상대가 보기 전에 내 선호를 먼저 표현할 수 있다.
- 인수 조건: 탭 즉시 화면 전환(낙관적 업데이트), 저장 실패 시 되돌림 / 상대 선택 데이터는 API 응답 자체에서 제외(프론트 숨김 아님)
- 상태: ✅ 완료 (`/round/new`, `CategoryPicker.tsx`, `RoundView.tsx`)

### US-2.2 동시 공개 판정
- **As a** 자녀, **I want to** 양쪽 다 선택을 마치면 자동으로 공개돼서, **so that** 따로 "공개하기" 버튼을 누를 필요가 없다.
- 인수 조건: 그리드끼리는 `item_id` 동등 비교(AI 호출 없음, 무료·즉시) / 사진·자유 라벨이 하나라도 끼면 AI가 직접 비교(에픽 3 참고), 결과를 `rounds.ai_matched`에 캐싱해 두 자녀가 각자 다시 계산 안 함
- 상태: ✅ 완료 (`/api/rounds/[id]/compare`)

### US-2.3 불일치 시 조율 도구 4종
- **As a** 자녀, **I want to** 다르게 골랐을 때 룰렛/번갈아하기/둘 다 하기/직접 정하기 중 골라 정할 수 있게, **so that** 다투지 않고 재미있게 끝낼 수 있다.
- 인수 조건: 번갈아하기는 카테고리별 최근 승자 이력을 기억해 공정하게 순번 배정
- 상태: ✅ 완료 (`RoundView.tsx`의 조율 UI, `resolutions` 테이블)

### US-2.4 실시간 동기화 버그 수정
- **As a** 자녀, **I want to** 상대가 선택/조율하면 화면을 새로고침하지 않아도 바로 반영되길, **so that** 계속 기다리는 느낌 없이 자연스럽게 이어진다.
- 인수 조건: `choices`/`resolutions` 테이블 변경을 Postgres Changes로 구독
- 상태: ✅ 완료(버그 수정) — 처음엔 `supabase_realtime` publication에 테이블을 추가한 적이 없어 Realtime 이벤트가 전혀 오지 않던 결함이 있었다(`0010_enable_realtime.sql`로 수정). 3초 폴링 폴백도 병행해 안전망 유지.

### US-2.5 동시 라운드 생성 중복 방지
- **As a** 자녀, **I want to** 상대와 거의 동시에 "새로운 선택 시작하기"를 눌러도 같은 라운드에서 만나길, **so that** 서로 다른 라운드에 혼자 남아 상대를 영원히 기다리지 않는다.
- 인수 조건: 카테고리당 이미 `waiting` 상태 라운드가 있으면 새로 만들지 않고 그 라운드에 합류
- 상태: ✅ 완료(버그 수정) — `0011_one_waiting_round_per_category.sql`

---

## 에픽 3. 사진으로 고르기

### US-3.1 사진 촬영 → AI 자유 라벨링
- **As a** 자녀, **I want to** 목록에 없는 물건도 사진으로 찍어서 고를 수 있게, **so that** 억지로 비슷한 항목을 고르지 않아도 된다.
- 인수 조건: 항목 목록에 끼워맞추지 않고 AI가 짧은 한국어 라벨(3~8글자)로 자유롭게 설명 + confidence 반환 / "사람 없이 물건만 찍어주세요" 안내 상시 노출 / 업로드 전 클라이언트에서 1024px로 축소+재압축
- 상태: ✅ 완료 (`RoundView.tsx`, `/api/rounds/[id]/classify-photo`, `src/lib/imageResize.ts`)

### US-3.2 낮은 신뢰도 → 수동 라벨 입력 / 높은 신뢰도 → 확인
- **As a** 자녀, **I want to** AI가 확신 없으면 직접 라벨을 입력하고, 확신 있으면 "OO 맞아요?"로 빠르게 확인만 하도록, **so that** AI가 틀렸는데 그대로 저장되는 일이 없다.
- 인수 조건: confidence가 낮으면 확인 단계 없이 바로 직접 입력 화면 / 확인해야만 실제 선택(`choices`)으로 제출됨 — AI 응답을 확인 없이 자동 제출하지 않음
- 상태: ✅ 완료 (`RoundView.tsx`의 `photoStatus` 상태 머신)

### US-3.3 AI 실패 시 안전한 폴백
- **As a** 자녀, **I want to** AI 사진 분석이 잠깐 안 되더라도 사진으로 고르기 자체는 계속 쓸 수 있게, **so that** 서버 문제 때문에 아예 못 고르는 일이 없다.
- 인수 조건: AI 호출이 예외를 던져도 "confidence 낮음"과 동일하게 취급해 사진은 저장하고 수동 라벨 입력으로 자연스럽게 넘어감
- 상태: ✅ 완료 (2026-09-13, Azure 리소스 장애 대응 중 발견해 수정) — `/api/rounds/[id]/classify-photo`

### US-3.4 공개 시점 AI 비교 실패 시 안전한 기본값
- **As a** 자녀, **I want to** AI 비교가 실패해도 공개 화면이 멈추지 않고 다음 단계(조율)로 넘어가길, **so that** "비교하는 중..." 화면에 영원히 갇히지 않는다.
- 인수 조건: AI 비교 실패 시 `matched=false`로 기본 처리(안전한 쪽 — 실제로 같아도 조율을 한 번 더 하는 게, 다른데 "같음"으로 오판해 조율을 건너뛰는 것보다 낫다)
- 상태: ✅ 완료(버그 수정, 2026-09-13) — 이전에는 AI 호출 실패 시 클라이언트의 `matchResult`가 `null`로 영원히 남아 재시도 없이 스피너에서 멈추는 심각한 버그였다. `/api/rounds/[id]/compare`

---

## 에픽 4. 기록(히스토리)

### US-4.1 라운드 기록 조회 (자녀/부모 공용)
- **As a** 자녀/부모, **I want to** 지난 라운드에서 뭘 골랐고 어떻게 조율됐는지 보고 싶다, **so that** 지난 선택을 돌아볼 수 있다.
- 인수 조건: 자녀 화면에도 노출되는 **의도된 예외**(양보 지수·통계 자녀 비노출 원칙과 다름, 사용자가 명시적으로 승인) / 자녀별 탭
- 상태: ✅ 완료 (`/history`, `HistoryView.tsx`)

### US-4.2 "이번엔 누구 차례?" AI 제안
- **As a** 부모/자녀, **I want to** 다음 라운드에서 누구에게 먼저 고를 기회를 주면 좋을지 부드러운 제안을 받고 싶다, **so that** 매번 같은 아이가 손해 본다는 느낌 없이 자연스럽게 순서를 정할 수 있다.
- 인수 조건: **누구를 제안할지는 AI가 아니라 코드가 먼저 계산**(최근 2주 양보 횟수 비교), AI는 그 결론을 부드러운 문장으로 표현하는 역할만 / 최소 표본(2주 4회) 미만이면 호출 자체를 안 함 / 명시적 버튼 클릭 시에만 호출
- 상태: ✅ 완료 (`PrioritySuggestion.tsx`, `/api/history/priority-suggestion`)

---

## 에픽 5. 카테고리/항목 커스터마이징

### US-5.1 카테고리 추가·숨기기
- **As a** 부모, **I want to** 카테고리를 직접 추가하고 필요 없으면 숨기고 싶다, **so that** 우리 가족 상황에 맞게 커스터마이징할 수 있다.
- 인수 조건: 하드 삭제 대신 `is_active=false`(soft delete) — 과거 기록이 깨지지 않음 / 자녀는 SELECT만 가능
- 상태: ✅ 완료 (`0006_category_customization.sql`, `/settings/categories`, `CategoriesManager.tsx`)

### US-5.2 항목 추가·숨기기
- **As a** 부모, **I want to** 카테고리 안의 항목(이모지+이름)을 직접 관리하고 싶다, **so that** 실제로 우리 아이들이 고를 만한 것들로 채울 수 있다.
- 상태: ✅ 완료 (`/settings/categories/[id]`, `ItemsManager.tsx`)

### US-5.3 자주 나온 사진 라벨 → 항목 승격 제안
- **As a** 부모, **I want to** 아이들이 사진으로 자주 고른 물건을 정식 항목으로 쉽게 추가하고 싶다, **so that** 매번 사진을 찍지 않고도 다음부터 목록에서 바로 고를 수 있다.
- 인수 조건: 같은 자유 라벨이 카테고리당 3번 이상 반복되면 제안 카드로 노출 / "+ 항목으로 추가"는 이름만 폼에 채울 뿐 — 이모지 선택과 최종 "추가하기"는 부모가 직접 해야 실제 항목이 생김(자동 추가 아님) / 이미 같은 이름 항목이 있으면 제안에서 자연히 빠짐
- 상태: ✅ 완료 (`ItemsManager.tsx`의 제안 카드)

---

## 에픽 6. 사진 아카이브

### US-6.1 부모가 사진 모아보고 라벨 수정
- **As a** 부모, **I want to** 아이들이 "사진으로 고르기"에서 찍은 사진들을 한 화면에서 모아보고 라벨을 고치고 싶다, **so that** AI가 잘못 붙인 라벨을 바로잡거나 나중에 다시 볼 수 있다.
- 인수 조건: 조회는 기존 블라인드 규칙 그대로(본인 것은 항상, 상대/부모는 라운드가 공개된 뒤에만) / 라벨 수정만 부모 전용으로 새로 열림
- 상태: ✅ 완료 (`0007_photo_archive.sql`, `/settings/photos`, `PhotoArchive.tsx`)

---

## 에픽 7. 부모 대시보드 (양보 지수)

### US-7.1 자녀별 양보 지수 카드
- **As a** 부모, **I want to** 각 아이가 불일치 상황에서 얼마나 자주 양보했는지 숫자로 보고 싶다, **so that** 한쪽이 계속 손해 보고 있지는 않은지 확인할 수 있다.
- 인수 조건: 최소 표본(조율 4회) 미만이면 "아직 데이터가 부족해요"만 표시 / 집계는 클라이언트가 아니라 서버 컴포넌트에서 `role='parent'` 확인 후 계산(RLS는 행 단위까지만 막을 수 있어 집계 결과 자체는 서버가 지켜야 함)
- 상태: ✅ 완료 (`src/lib/concessionStats.ts`, `/settings/dashboard`)

### US-7.2 주간 추이 그래프
- **As a** 부모, **I want to** 최근 몇 주간 양보 추이를 그래프로 보고 싶다, **so that** 한순간의 숫자가 아니라 패턴을 볼 수 있다.
- 인수 조건: 카테고리컬 색상(자녀 a/b 토큰)이 색맹 대비 기준 floor 구간이라 항상 범례+막대 위 숫자를 같이 노출(색상에만 의존하지 않음) / 자녀 수가 늘어도 카드 폭 안에서 막대가 동적으로 줄어들고, SVG 자체가 `overflow-x-auto`로 감싸져 있어 페이지 전체 가로 스크롤로 새지 않음
- 상태: ✅ 완료 (`ConcessionChart.tsx`)

---

## 에픽 8. AI 패턴 관찰 리포트

### US-8.1 AI 관찰 요약
- **As a** 부모, **I want to** 버튼을 눌렀을 때만 최근 데이터를 사실 위주 문장으로 요약해주길, **so that** 숫자만 보는 것보다 이해하기 쉽다.
- 인수 조건(8원칙, [CLAUDE.md](../CLAUDE.md) 참고): 진단적 언어 금지 / 디스클레이머 상시 표시 / 자녀 화면 노출 절대 금지 / 최소 표본(최근 2주 4회) 미만이면 생성 자체 안 함 / 풀(pull) 방식(자동 알림 아님) / 성격·기질 라벨링 금지 / 명시적 버튼 트리거로만 호출 / 시스템 프롬프트 강제 + 출력 금지어 필터 이중 안전장치
- 상태: ✅ 완료 (`ObservationReport.tsx`, `/api/dashboard/observation-report`, `src/lib/observationSafety.ts`)

### US-8.2 AI 실패와 "데이터 부족"을 구분해서 안내
- **As a** 부모, **I want to** AI 호출 자체가 실패했을 때 "데이터가 부족해요"라는 잘못된 메시지 대신 정확한 안내를 보고 싶다, **so that** 데이터가 충분한데도 뭔가 잘못됐다고 오해하지 않는다.
- 인수 조건: 최소 표본 미달(정상)과 AI 호출 실패(장애)를 서로 다른 응답으로 구분
- 상태: ✅ 완료(버그 수정, 2026-09-13, Azure 리소스 장애 대응 중 발견) — `/api/dashboard/observation-report`, `/api/history/priority-suggestion`

---

## 에픽 9. 푸시 알림

### US-9.1 알림 켜고 끄기
- **As a** 자녀/부모, **I want to** 홈 화면에서 푸시 알림을 켜고 끌 수 있게, **so that** 앱을 계속 열어두지 않아도 상대의 움직임을 알 수 있다.
- 인수 조건: 통계성 정보가 아니라 역할 구분 없이 부모·자녀 공통 기능 / 같은 기기를 형제가 돌려쓰는 경우 `push_subscriptions.endpoint`를 전역 유니크로 두고 재구독 시 소유권을 현재 로그인한 사람에게 이전(upsert)
- 상태: ✅ 완료 (`PushNotificationToggle.tsx`, `/api/push/subscribe`, `/api/push/unsubscribe`)

### US-9.2 라운드 생성/공개 시점 알림
- **As a** 자녀, **I want to** 상대가 라운드를 시작하거나 내 제출로 라운드가 공개되면 알림을 받고 싶다, **so that** 앱을 계속 열어보지 않아도 된다.
- 인수 조건: DB 트리거가 아니라 **그 일을 실제로 일으킨 클라이언트가 직접 호출**(fire-and-forget, 실패해도 게임 진행 지장 없음) / 다른 프로필의 구독 정보를 읽어야 해서 이 라우트만 서비스 롤 사용
- 상태: ✅ 완료 (`CategoryPicker.tsx`, `RoundView.tsx`, `/api/push/notify`, `src/lib/webpush.ts`)

---

## 에픽 10. "왜 이게 좋아?" 음성으로 이유 남기기

### US-10.1 음성 녹음 → 텍스트 변환 → 확인 후 저장
- **As a** 자녀, **I want to** 블라인드 선택 후 상대를 기다리는 동안 왜 이걸 골랐는지 목소리로 말할 수 있게, **so that** 탭 한 번으로 끝나던 선택에 내 생각을 표현하는 순간이 생긴다.
- 인수 조건: 완전히 선택적, 건너뛰어도 제출/공개 흐름에 지장 없음 / **음성 자체는 어디에도 저장하지 않음** — 변환 직후 서버가 버림, 변환된 텍스트만 자녀가 확인해야 저장(AI 결과 자동 저장 금지 원칙과 동일)
- 상태: ✅ 완료 (`VoiceReasonRecorder.tsx`, `/api/rounds/[id]/transcribe-reason`, `0012_choice_reason.sql`)

### US-10.2 Whisper → Azure AI Speech 전환
- **As a** 개발자, **I want to** 이 프로젝트의 Azure OpenAI 리소스 리전에서 배포 불가능한 Whisper 대신 다른 방식으로 음성 인식을 구현하고, **so that** 새 리소스를 만들지 않고도 기능을 유지할 수 있다.
- 인수 조건: 브라우저 기본 `MediaRecorder`(webm/opus)를 Azure AI Speech REST API가 거부해서, Web Audio API로 16kHz mono WAV를 직접 인코딩하는 방식으로 교체(자매 앱 reading-buddy가 이미 검증한 패턴을 그대로 포팅)
- 상태: ✅ 완료 (2026-09-13) — `src/lib/azureSpeech.ts`, `src/lib/pcmRecorder.ts`. 무음 테스트 오디오로 실제 Azure 호출까지 성공 확인(정상적인 "인식 실패" 응답을 받음)

---

## 에픽 11. 비주얼 리디자인

### US-11.1 파스텔 블록 카드 + 검은 선 아이콘
- **As a** 사용자(부모/자녀), **I want to** 더 또렷하고 통일된 룩앤필을, **so that** 앱이 더 완성도 있게 느껴진다.
- 인수 조건: `border-2 border-ink` 전 컴포넌트 적용, 버튼 텍스트 흰색→검은색(대비 개선, ~2.5:1 → ~7:1) / 카테고리/항목 색상은 인덱스 기반 5색 순환 배정(`tilePalette.ts`) — 부모가 자유롭게 추가하는 콘텐츠라 이름/개수와 무관하게 항상 동작 / 카테고리/항목 이모지는 그대로 유지(고정 SVG 아이콘은 로그인/네비/조율 도구 등 앱 고정 UI에만 적용) / 폰트는 Jua(타이틀)+Gothic A1(본문)
- 상태: ✅ 완료 (`tailwind.config.ts`, `globals.css`, `src/lib/tilePalette.ts`, `src/components/icons.tsx`)

---

## 에픽 12. 해커톤 심사용 데모 진입점

### US-12.1 회원가입 없이 핵심 흐름 체험
- **As a** 심사자, **I want to** 회원가입 없이 블라인드 선택→공개→조율과 부모 대시보드(AI 관찰 요약 포함)를 30초 안에 체험하고 싶다, **so that** 실제 사용자 경험을 빠르게 파악할 수 있다.
- 인수 조건: 고정된 "체험용 가족"(join_code `DEMO26`, 부모 `demo-judge@twin-choice.internal`, 자녀 PIN `1111`/`2222`) / 매 실행마다 그 가족의 라운드/조율 이력만 지우고 최근 2주 내 이력 6건으로 재시딩 / 데모 자격증명이 `/demo`에 공개 노출되는 건 의도된 설계(RLS로 이 가족 데이터만 위험 범위)
- 상태: ✅ 완료 (`scripts/seed-demo-family.ts`, `/demo`) — **제품 기능이 아니라 심사용 임시 장치**, Phase 번호에 포함 안 함

---

## 에픽 13. 자매 앱 reading-buddy 개발 내역 역이식

이 앱과 reading-buddy는 인증/RLS 패턴을 공유하는 자매 프로젝트다(원래 twin-choice → reading-buddy 방향으로 패턴이 이식됨). reading-buddy가 더 오래 실사용되며 twin-choice에는 없던 개선을 축적했고, 2026-09-13에 그중 적용 가치가 있는 것만 역이식했다.

### US-13.1 인증 이중 확인 제거 (성능)
- **As a** 사용자, **I want to** 화면 전환이 느리게 느껴지지 않길, **so that** 앱을 쾌적하게 쓸 수 있다.
- 인수 조건: `middleware.ts`가 모든 요청에서 이미 `getUser()`로 세션을 검증/갱신하는데, 그 뒤 `getCurrentProfile()`과 API 라우트 10곳이 각자 또 `getUser()`를 호출해 Supabase Auth 서버에 불필요한 왕복을 만들고 있었음 — 전부 로컬 `getSession()`으로 통일
- 상태: ✅ 완료 — `src/lib/currentProfile.ts` + API 라우트 10곳

### US-13.2 Vercel 서버 함수 리전 고정
- **As a** 개발자, **I want to** Vercel 서버 함수가 Supabase와 같은 리전에서 실행되길, **so that** 매 요청마다 불필요한 지역 간 왕복이 생기지 않는다.
- 상태: ✅ 완료 — `vercel.json`(`regions: ["icn1"]`), Supabase 실제 리전 확인은 배포 후 `x-vercel-id` 헤더로 재확인 필요

### US-13.3 Vitest 유닛 테스트 인프라 도입
- **As a** 개발자, **I want to** 순수 로직 함수들에 자동 테스트를 붙이고 싶다, **so that** 리팩터링이나 재작성 때 회귀를 빠르게 잡을 수 있다.
- 인수 조건: `server-only`로 막힌 모듈을 vitest에서 import 가능하도록 빈 스텁으로 alias
- 상태: ✅ 완료 — `vitest.config.mts`, 25개 테스트(`tilePalette`, `joinCode`, `childAuth`, `concessionStats`, `observationSafety`)

---

## 에픽 14. AI 인프라 복구 (Azure 리소스 삭제 대응)

### US-14.1 삭제된 Azure OpenAI 리소스를 자매 프로젝트 리소스로 대체
- **As a** 개발자, **I want to** 삭제된 전용 Azure 리소스 대신 이미 살아있는 reading-buddy의 리소스를 재사용하고 싶다, **so that** 새 인프라를 만들지 않고도 빠르게 AI 기능을 복구할 수 있다.
- 인수 조건: 메인 AI(사진 분석/비교/관찰요약/제안)는 `reading-buddy-openai`의 기존 `gpt-4o` 배포 재사용(코드 변경 없음) / 음성 인식은 Whisper 대신 `reading-buddy-speech`(Azure AI Speech) 재사용(에픽 10.2)
- 상태: ✅ 완료 (2026-09-13) — 실제 배포 사이트에서 사진 분석·음성 인식 둘 다 실제 Azure 호출 성공까지 확인
