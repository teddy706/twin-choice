# CLAUDE.md — 따로 또 같이 (쌍둥이 선택 기록 앱)

이 파일은 프로젝트 루트에 두고 Claude Code가 매 세션 시작 시 참고하는 컨텍스트 문서입니다. **Phase 1은 완료됐고, 지금은 Phase 2를 아래 "Phase 2 진행 순서"대로 하나씩 순차 구현 중입니다.** Phase 3, 사업화, 연인용 확장 기능은 이 시점에 손대지 마세요.

## 프로젝트 개요

일란성 쌍둥이(및 형제자매) 자녀가 영상·과자·장난감 등을 고를 때, 상대 선택을 보기 전에 각자 블라인드로 먼저 고르고 → 동시 공개 → 다르면 정해진 조율 도구로 해결하는 가족용 웹앱. 목적은 아이들이 서로 눈치 보며 양보하는 패턴을 줄이고, 부모가 각 아이의 진짜 취향과 양보 패턴을 데이터로 파악하는 것.

- **전체 요구사항**: PRD 참조 (아래 "참고 문서" 링크)
- **이번 스프린트 범위**: 이 문서의 "Phase 2 진행 순서" 섹션 — 그중 아직 체크 안 된 항목 중 제일 위에 있는 것부터

## 확정된 기술 결정 (재논의 불필요)

| 항목 | 결정 |
|---|---|
| 배포 형태 | PWA (네이티브 앱 아님) |
| 프론트엔드 | Next.js (App Router) + React + Tailwind CSS |
| 백엔드/DB | Supabase (PostgreSQL + Auth + Storage + Realtime), 무료 티어 |
| 인증 — 부모 | Supabase Auth 이메일 로그인 |
| 인증 — 자녀 | 이메일 없음. `profile_id + 4자리 PIN` → family 코드로 특정한 뒤, PIN에서 결정론적으로 파생한 비밀번호로 synthetic 이메일 계정에 로그인해 **실제 Supabase Auth 세션**을 발급(`role`은 JWT 클레임이 아니라 `profiles.role` 컬럼으로 판별) |
| 권한 분리 | 프론트엔드 라우팅 차단 + **RLS(Row Level Security)로 DB 레벨 차단**이 필수. 프론트엔드만으로 막지 않음 |
| 실시간 동기화 | Supabase Realtime (구현은 Postgres Changes 구독 사용, Broadcast/Presence 아님), 3초 폴링 폴백 |
| 사진 AI 분석 | Azure OpenAI (vision + function calling 지원 배포, 기본값 `gpt-4o`/`gpt-4o-mini`) — 사용자가 Azure 비용을 직접 부담하기로 해서 Anthropic 직접 호출 대신 채택. **자동 호출 금지** — 사진을 찍거나(선택 제출 시) 라운드가 공개되는(비교 시) 그 순간에만 호출. 용도 두 가지: (1) Phase 1 "사진으로 고르기" — 항목 목록에 억지로 끼워맞추지 않고 **자유 라벨**로 설명하게 한 뒤, 공개 시점에 두 선택(사진/라벨)을 AI가 직접 비교해서 같은 걸 골랐는지 판정. AI가 사진을 못 알아보면 아이가 직접 라벨을 입력, (2) Phase 2 사진 아카이브 분류 |
| 소프트 삭제 | 카테고리/항목은 하드 삭제 대신 `is_active=false` |
| 확장성 원칙 | 전 테이블 `family_id` 기반. 코드에 "가족은 하나뿐"이라는 가정(하드코딩된 family_id, 환경변수 등)을 절대 심지 않을 것 |

## Phase 1 스코프 (완료)

- [x] **인증/역할 분리**: 부모 회원가입·로그인, 자녀 프로필 생성(이름+아바타+PIN), 자녀 PIN 로그인
- [x] **RLS 정책**: 자녀 세션은 분석/대시보드 관련 테이블 SELECT 자체가 불가능하도록 DB 레벨 설정
- [x] **블라인드 선택 → 동시 공개 → 조율 흐름**: 기존 프로토타입(`reference/twin-choice-app-prototype.html`, 아래 참조) 로직을 정식 백엔드로 이관
  - 조율 도구 4종: 룰렛(랜덤 50:50), 번갈아하기(카테고리별 최근 승자 기억), 둘 다 하기, 직접 정하기
- [x] **기록(히스토리)**: 자녀 화면에는 "무엇을 골랐는지"만, 통계/양보지수는 절대 노출 금지
- [x] **개인정보 최소 요건**: 광고/추적 SDK 미포함, 부모가 자녀 데이터 전체 삭제 가능, 사진 비공개 스토리지
- [x] **사진으로 고르기**: 그리드 탭과 함께 제공되는 대체 입력 방식. 자녀가 사물을 촬영 → AI가 자유롭게 짧은 라벨로 설명(confidence 포함) → confidence가 낮으면 자녀가 직접 라벨을 타이핑, 높으면 "OO 맞아요?"로 확인 → 확인해야 실제 선택(`choices.label` + `photo_id`, `item_id`는 null)으로 제출됨. 공개 시점에 그리드끼리는 `item_id` 동등 비교(무료/즉시), 사진/라벨이 하나라도 끼면 AI가 양쪽을 직접 비교해서 판정하고 결과를 `rounds.ai_matched`에 캐싱(두 자녀가 각자 다시 계산하지 않도록). 자녀 role만 사용 가능(부모는 블라인드 선택에 참여하지 않음)

## Phase 2 진행 순서

번호 순서대로 하나씩 진행하기로 합의됨. 앞 번호가 안 끝났으면 뒷 번호에 먼저 손대지 말 것.

- [x] **1. 카테고리/항목 커스터마이징** — 부모가 카테고리/항목을 직접 추가·soft delete. `/settings/categories`, `/settings/categories/[id]`. `categories`/`items` INSERT/UPDATE RLS를 `role='parent'` + family 스코프로 오픈(`0006_category_customization.sql`). 자녀는 여전히 SELECT만.
- [x] **2. 사진 아카이브** — 부모가 `photos` 테이블에 이미 쌓인 사진들을 갤러리로 모아보고 라벨 수정. `/settings/photos`. 조회는 기존 `photos_select`(블라인드 규칙 그대로 재사용, 새 정책 불필요)로 충분했고, 라벨 수정용 `photos_update`만 `role='parent'`로 새로 열었다(`0007_photo_archive.sql`). 부모 전용 화면이 늘어나서 하단 탭을 각 화면별로 나열하지 않고 `/settings` 허브로 통합(자녀 관리/카테고리/사진 아카이브 링크 모음).
- [x] **3. 부모 대시보드 (양보 지수·추이 그래프)** — `/settings/dashboard`. 집계(`src/lib/concessionStats.ts`)는 새 RPC/API 라우트 대신 **서버 컴포넌트 안에서 role='parent' 확인 후 계산**하는 방식으로 구현(클라이언트는 절대 GROUP BY 안 함 — 원칙은 지키되 굳이 새 엔드포인트를 안 만들어도 되는 기존 패턴). 최소 표본(조율 4회) 미만이면 "아직 데이터가 부족해요"만 표시. 주간 추이는 `dataviz` 스킬 절차대로: 카테고리컬 색상은 앱 기존 a/b 토큰 재사용 + 팔레트 검증기로 CVD 대비 확인(6.8, floor 구간 — 그래서 항상 범례+막대 위 숫자 직접 라벨을 같이 노출해 색상에만 의존하지 않게 함).
- [x] **4. AI 패턴 관찰 리포트** — `/settings/dashboard`의 "🔎 AI 관찰 요약" 카드. 3번의 집계(최근 2주 버킷 합)를 그대로 재사용하고, `role='parent'` 확인은 API 라우트(`/api/dashboard/observation-report`)에서 다시 한번(클라이언트 role 신뢰 안 함). 최근 2주 조율 4회 미만이면 AI 호출 자체를 안 하고 "아직 데이터가 부족해요"만 반환(원칙 4). 8원칙을 시스템 프롬프트에 명시적으로 강제(`generateObservationSummary`, `src/lib/azureOpenAI.ts`)하고, 출력 직전에 금지어 필터(`src/lib/observationSafety.ts`)로 한 번 더 걸러 걸리면 아예 안 보여줌(원칙 8). 버튼 클릭 전엔 아무것도 호출 안 함(원칙 7), 디스클레이머는 하드코딩으로 항상 표시(원칙 2). 실제 생성 예시(정상 통과): "OO는 최근 2주 동안 4번의 조율 중 4번을 양보했습니다." — 진단·성격 언어 없이 사실 나열만.
- [x] **5. 푸시 알림** — `push_subscriptions` 테이블(`0009_push_notifications.sql`) + `web-push`(VAPID). 트리거는 DB가 아니라 **그 일을 실제로 일으킨 클라이언트가 직접 호출**하는 방식: 라운드 생성 직후(`CategoryPicker`), 그리고 자기 제출이 라운드를 공개시키는 "마지막 한 명"일 때(`RoundView`)만 `/api/push/notify`를 fire-and-forget으로 부른다(실패해도 게임 진행엔 지장 없음). 다른 프로필의 구독 정보를 읽어야 해서 이 라우트만 서비스 롤 사용. 홈 화면의 `PushNotificationToggle`로 켜고 끔(부모·자녀 공통 — 통계성 정보가 아니라 역할 구분 불필요). 같은 기기를 형제가 돌려쓰는 경우를 고려해 `push_subscriptions.endpoint`를 전역 유니크로 두고 재구독 시 소유권을 현재 로그인한 사람에게 넘긴다(upsert). `public/icons/icon-192.png`·`icon-512.png` 실제 파일도 이번에 같이 채워 넣음(Phase 1부터 비어있던 항목 — PWA 설치 아이콘과 알림 아이콘 둘 다 이걸 씀).
- [x] **6. 자녀 프로필 사진** (계획 밖 추가 요청) — 이모지 아바타 대신/추가로 실제 얼굴 사진 업로드. `profiles.avatar_photo_path` + 비공개 `avatars` 스토리지 버킷. 부모가 `/settings/children`에서 자녀별로 업로드/교체(`0008_child_avatar_photos.sql`). **의도적으로 손대지 않은 부분**: 자녀 로그인 화면의 "누구예요?" 프로필 선택 단계(PIN 입력 *전*, 가족 코드만으로 도달 가능)는 이모지만 유지 — 거기서 실제 얼굴 사진을 보여주면 가족 코드만 알아도(비밀번호 없이) 아이 사진을 볼 수 있게 되는 프라이버시 문제가 생기기 때문. 실제 사진은 PIN 로그인 이후 화면(Topbar 등)에만 노출.

### 번외: "왜 이게 좋아?" 음성 이유 남기기

이 앱을 만든 근본 동기(쌍둥이 사이 부모의 중립 유지 + 양보하는 마음과 자기 의견을 조리있게 말하는 성장을 AI가 중립적으로 도와주는 것)를 다시 짚어보고 추가한 기능. 기존엔 탭 한 번으로 고르는 게 전부라 아이가 자기 생각을 말로 표현하는 순간이 없었다.

- 자녀가 블라인드 선택을 낸 뒤 상대를 기다리는 화면(`RoundView.tsx`)에 `VoiceReasonRecorder`가 뜬다 — 완전히 선택적, 건너뛰어도 제출/공개 흐름에 전혀 지장 없음.
- **음성 인식은 브라우저 자체 API가 아니라 녹음 → 서버에서 Azure OpenAI Whisper로 변환**하는 방식으로 확정(iOS Safari의 Web Speech API 지원이 역사적으로 들쭉날쭉해서 — 이 프로젝트가 실기기로 계속 검증해온 플랫폼과 안 맞음). `AZURE_OPENAI_WHISPER_DEPLOYMENT` 환경변수로 기존 gpt-4o 배포와 별개의 Whisper 배포를 가리킨다.
- **아이 목소리 자체는 어디에도 저장하지 않는다** — `/api/rounds/[id]/transcribe-reason`이 변환만 하고 오디오는 그 자리에서 버린다. 사진과 달리 목소리는 더 민감한 데이터로 취급(개인정보 최소화 원칙의 연장).
- 변환된 텍스트는 AI가 만든 다른 결과물과 동일하게 **자녀가 확인해야 저장된다**(코딩 시 주의사항 6번과 같은 원칙) — 자동 저장 안 함.
- `choices.reason` 컬럼에 저장(`0012_choice_reason.sql`). 이 테이블은 그동안 UPDATE 정책이 전혀 없었는데, 본인 소유 선택에 한해 `reason`만 고칠 수 있게 새로 열면서 `item_id`/`label`/`photo_id`는 컬럼 단위 GRANT로 여전히 못 바꾸게 막았다(`0008_child_avatar_photos.sql`의 profiles avatar 패턴 재사용).
- 공개 화면과 `/history`에 이유가 있으면 인용구로 같이 보여준다 — 블라인드 규칙은 choices row 자체가 이미 지키고 있어서(공개 전엔 상대 choices row 자체가 안 보임) 별도 처리 불필요.

### 번외: 해커톤 심사용 데모 진입점 (제품 기능 아님)

원티드 AI Championship 2026 제출을 위해 추가한 임시 장치. 심사자가 회원가입 없이 핵심 흐름(블라인드 선택 → 동시 공개 → 조율)과 부모 대시보드(AI 관찰 요약 포함)를 30초 안에 체험할 수 있게 한다 — Phase 2 번호에 포함하지 않는다.

- `scripts/seed-demo-family.ts` — 고정된 "체험용 가족"(join_code `DEMO26`, 부모 `demo-judge@twin-choice.internal`, 자녀 PIN `1111`/`2222`)을 만들고(있으면 재사용), 매 실행마다 그 가족의 라운드/조율 이력만 지우고 최근 2주 내로 날짜를 맞춘 이력 6건을 새로 채운다(대시보드 `MIN_SAMPLE`/`observation-report`의 `MIN_RECENT_SAMPLE` 게이트를 실행 시점과 무관하게 항상 통과시키기 위해 `weekStartUTC()` 로직을 그대로 복제해 날짜를 계산). `npm run seed:demo`로 실행(`.env.local` 자동 로드) — dev/prod가 같은 Supabase 프로젝트라 로컬 실행이 곧 배포본에도 반영된다. **독립 실행 스크립트라 `src/lib/supabase/admin.ts`/`childAuth.ts`/`defaultCategories.ts`를 import하지 않고 로직만 복제**했다(그 파일들의 `"server-only"`가 tsx 단독 실행 컨텍스트에서 에러를 던지기 때문) — 원본이 바뀌면 이 스크립트도 함께 맞춰야 한다.
- `/demo` 페이지 — 인증 없는 공개 라우트. 위 자격증명을 그대로 보여주고 `/login/child`·`/login/parent`로 안내한다. 로그인 페이지들의 상태 로직(가족코드→프로필→PIN)은 전혀 건드리지 않았다.
- `src/app/login/page.tsx` 맨 아래에 "심사위원이신가요? 데모 체험하기" 링크 한 줄만 추가(작은 글씨, 실제 가족 사용자 흐름과 분리).
- **실제 브라우저로 검증하며 찾은 함정**: 같은 브라우저에서 탭 2개를 열어 각각 자녀 로그인을 해도 "쌍둥이 체험"이 안 된다 — Supabase Auth 세션 쿠키가 브라우저(오리진) 전체에 공유되기 때문에 둘째로 로그인하는 순간 첫째 탭의 세션도 둘째로 바뀐다. 그래서 `/demo` 안내 문구는 "새 탭 2개"가 아니라 **"일반 창 1개 + 시크릿/프라이빗 창 1개(또는 서로 다른 브라우저 2개)"**로 되어 있다 — 이건 실제 제품(두 자녀가 각자 다른 기기를 쓴다고 가정)에서는 잘 안 드러나던 제약이라, 자녀 로그인 흐름 관련 코드를 만질 때 참고할 것.
- 보안: 데모 부모 비밀번호·자녀 PIN이 `/demo`에 공개 노출되는 건 의도된 설계다. RLS가 family_id로 완전히 격리하므로 위험 범위는 이 데모 가족 데이터로만 한정된다(실제 가족은 전혀 영향 없음). 지저분해지면 `npm run seed:demo` 재실행으로 초기화 — 공개 초기화 버튼/엔드포인트는 일부러 안 만들었다.
- 해커톤이 끝나면 `login/page.tsx`의 링크 한 줄만 지우면 된다(라우트 자체는 남겨둬도 무해).

### 번외: 기록 화면 확장 + 사진 라벨 → 항목 승격 제안

- `/history`가 부모 전용이 아니게 된 배경과 예외 범위는 "코딩 시 주의사항" 1번 참고.
- `PrioritySuggestion.tsx`("이번엔 누구 차례?")는 `ObservationReport.tsx`와 같은 3중 안전장치(시스템 프롬프트 원칙 + `containsBannedLanguage` 필터 + 명시적 버튼 트리거 + 최소 표본 게이트)를 그대로 쓰지만, **누구를 제안할지는 AI가 아니라 `/api/history/priority-suggestion`의 코드가 먼저 계산**하고(최근 2주 양보 횟수 비교) AI는 그 결론을 부드러운 문장으로 표현하는 역할만 한다 — 공정성 판단 자체를 LLM에 맡기지 않기 위함.
- 사진으로 고른 자유 라벨(`choices.label`, `item_id is null`)이 같은 카테고리에서 3번 이상 반복되면 `/settings/categories/[id]`의 `ItemsManager`에 "자주 나온 사진 라벨" 제안 카드로 보여준다. 부모가 "+ 항목으로 추가"를 누르면 이름만 폼에 채워질 뿐 — 이모지 선택과 최종 "추가하기" 클릭은 그대로 해야 실제 `items` row가 생긴다(자동 추가 아님). 이미 같은 이름의 항목이 있으면 그 라벨은 자연히 제안에서 빠진다 — 별도의 "무시함" 추적 테이블은 없음.

### 번외: 비주얼 리디자인 — 파스텔 블록 카드 + 검은 선 아이콘

해커톤 참고 이미지(웨비나 플랫폼 기능 그리드)의 "파스텔 컬러 블록 카드 + 검은 테두리 + 검은 선 아이콘" 느낌을 앱 전체에 적용. Claude Design 캔버스로 로그인/홈/선택그리드/대시보드 4개 화면 시안을 먼저 만들어 합의한 뒤 실제 코드에 반영했다.

- **토큰**(`tailwind.config.ts`): `ink`를 `#3A3A3A` → `#1A1A1A`로 더 진하게. `a.tile`/`b.tile`(코랄·틸의 파스텔 버전) + 신규 `butter`/`sage`/`lilac` 3색 추가(전부 oklch, lightness/chroma 통일 — dataviz 스킬의 "accent는 hue만 바꾸고 L/C는 통일" 원칙). `shadow-card`를 더 플랫하게(무거운 그림자 대신 테두리가 입체감을 담당).
- **기본 컴포넌트**(`globals.css`): `.card`/`.item-tile`/`.who-badge`/`.btn-*` 전부 `border-2 border-ink` 추가. 버튼 텍스트가 흰색 → 검은색으로 바뀐 건 미관뿐 아니라 실제 대비(contrast) 개선이기도 하다(예: 흰 글자 vs 코랄 배경 대비 ~2.5:1 → 검은 글자 vs 코랄 배경 ~7:1).
- **카테고리/항목 타일 색상**: `src/lib/tilePalette.ts`의 `tileClassFor(index)`가 `tile-0`~`tile-4`(globals.css에 정의) 5색을 인덱스로 순환 배정. 카테고리/항목은 부모가 자유롭게 추가하는 콘텐츠라 색을 의미별로 고정할 수 없어서 — 이름이 뭐든 몇 개든 항상 동작해야 한다.
- **아이콘**: `src/components/icons.tsx`에 앱 고정 UI(로그인 역할, 모드 전환, 하단 네비, 대시보드/조율 도구)용 검은 선 SVG 아이콘 세트 신규 추가. **카테고리/항목 이모지는 그대로 유지** — `/settings/categories`의 자유 이모지 피커로 부모가 직접 고르는 실제 콘텐츠라, 고정 SVG 아이콘으로 대체하면 커스텀 카테고리가 깨진다. "이 방향을 어디에 적용할지"를 판단할 때 이 경계(고정 UI 크롬 vs 부모가 만드는 콘텐츠)를 기준으로 삼았다.
- **폰트**: Google Fonts `Jua`(로고/큰 타이틀 전용, `font-display` 유틸리티) + `Gothic A1`(본문 전체) — `layout.tsx`에 `<link>`로 로드. `next/font/google`을 안 쓰고 plain `<link>`를 쓴 이유: 두 폰트 다 한글 subset 필요한데 next/font/google의 subsets 배열 문자열이 정확히 뭔지 확신 없이 빌드를 깨뜨릴 위험을 피하려고 — CSS2 API `<link>`는 브라우저가 실제 쓰는 문자에 맞춰 자동으로 필요한 subset만 받아온다.

### 번외: reading-buddy 개발 내역 반영 (2026-09-13)

자매 앱 reading-buddy(같은 인증/RLS 패턴을 공유, 이 CLAUDE.md 상단 "참고 문서"와 반대로 twin-choice → reading-buddy 방향으로 패턴이 이식됐던 프로젝트)가 그 이후 더 오래 실사용/실기기 검증을 거치며 twin-choice에는 아직 없는 개선을 여럿 축적했다. 사용자 요청으로 그중 twin-choice 코드베이스를 직접 확인해서 "정말 없고 + 적용 가치가 있는 것"만 골라 역이식했다(도서 검색 API, ISBN, 감상문 생성 같은 reading-buddy 전용 기능은 대상에서 제외).

1. **자녀 PIN 로그인: 4자리 입력 즉시 자동 제출 → "확인" 버튼 방식으로 변경.** reading-buddy가 실사용 중 "PIN 4자리 누르자마자 서버로 넘어가서 응답 전까지 화면이 멈춘 것처럼 보인다"는 문제를 발견해 고쳤던 것과 정확히 같은 코드 패턴이 `/login/child`(`src/app/login/child/page.tsx`)에도 있었다. `onPinDigit()`이 4자리 채워지는 즉시 `submitPin()`을 호출하던 것을 제거하고, 키패드 아래에 "확인"(로딩 중 "확인하는 중...") 버튼을 추가해 그 버튼을 눌러야 제출되게 바꿨다.
2. **자녀 PIN 브루트포스 방지(5회 실패 시 1분 잠금) 추가.** reading-buddy는 이 정책을 twin-choice의 인증 패턴을 재사용하면서 "twin_choice에는 없는 재량 추가"로 넣었던 것 — 이번에 twin-choice에도 역으로 가져왔다. `profiles.pin_fail_count`/`pin_locked_until`(`0013_pin_lockout.sql`, **사용자가 Supabase SQL Editor에서 직접 실행해야 실제 DB에 반영됨** — 다른 마이그레이션과 동일한 관례) 추가, `src/lib/childAuth.ts`에 `PIN_MAX_ATTEMPTS`/`PIN_LOCK_DURATION_MS`/`isPinLocked()` 추가. `/api/auth/child-login`이 admin 클라이언트로 실패 시 카운트 증가(5회째에 잠금), 성공 시 리셋한다.
3. **Vercel 서버 함수 리전 고정.** reading-buddy는 `x-vercel-id` 헤더로 서버 함수가 Supabase 리전과 다른 곳(버지니아)에서 실행되던 걸 발견해 `vercel.json`으로 서울(icn1) 고정 — reading-buddy 문서가 "twin_choice에서도 같은 걸 느꼈다고 함"이라고 명시했던 부분이다. `vercel.json`을 신규 생성해 `regions: ["icn1"]` 지정. **Supabase 프로젝트가 실제로 서울 리전인지는 아직 확인 안 됨 — 배포 후 사용자가 `x-vercel-id` 응답 헤더로 실제 반영 여부/효과를 확인해야 한다.**
4. **인증 이중 확인 제거 (계획에 없었다가 재조사로 추가됨).** 원래는 "twin-choice엔 미들웨어가 없어서 해당 없음"이라고 판단했었는데, 실제로는 `src/middleware.ts`가 모든 요청(API 라우트 포함)에서 이미 `getUser()`로 세션을 검증/갱신하고 있었다(레포 루트에서만 `middleware.ts`를 찾다가 처음에 놓침). 그 위에서 `getCurrentProfile()`(`src/lib/currentProfile.ts`)과 API 라우트 10곳이 각자 또 `getUser()`를 호출해 Supabase Auth 서버에 불필요한 왕복을 만들고 있었던 것 — reading-buddy가 문서화한 "페이지 전환이 느리다"의 원인 중 하나(이중 인증 확인)와 정확히 같은 구조. 미들웨어가 이미 검증을 마쳤으므로 그 뒤의 모든 지점을 네트워크 왕복 없이 쿠키의 JWT를 로컬에서만 읽는 `getSession()`으로 통일했다(`getCurrentProfile()` + `/api/dashboard/observation-report`, `/api/children`, `/api/children/[id]`, `/api/rounds/[id]/{classify-photo,transcribe-reason,compare}`, `/api/push/{notify,subscribe,unsubscribe}`, `/api/history/priority-suggestion`, 루트 `/page.tsx`). 실제 로그인을 시도하는 `/api/auth/child-login`(synthetic 계정 `signInWithPassword`)은 세션 확인이 아니라 인증 자체라 그대로 뒀다.
5. **Vitest 유닛 테스트 인프라 도입.** reading-buddy와 동일하게 외부 의존성 없는 순수 함수부터 시작 — `vitest@^2.1.9`(reading-buddy가 최신 5.x의 `@types/node@^22` peer 요구와 이 프로젝트의 `@types/node@^20` 충돌을 피하려 고정했던 것과 같은 이유로 동일 버전 사용), `vitest.config.mts`가 `server-only`를 빈 스텁(`test/stubs/server-only.ts`)으로 alias(이 패키지가 react-server 조건 없는 Node 런타임=vitest에서 import되면 항상 예외를 던지기 때문 — reading-buddy에서 찾은 것과 같은 우회). `npm run test`. 첫 테스트 25개: `tilePalette.test.ts`, `joinCode.test.ts`, `childAuth.test.ts`(PIN 검증/결정론성/잠금 판정), `concessionStats.test.ts`(양보 지수 집계), `observationSafety.test.ts`(금지어 필터). 목표는 전체 커버리지가 아니라 인프라를 갖추고 대표 파일에 붙이는 것 — 앞으로 새 순수 로직을 추가할 때 계속 보강할 것(reading-buddy도 4개 파일 31개로 시작해 74개까지 늘어났다).
6. **모바일 오버플로우 점검.** reading-buddy는 flex 행 안의 `<input>`/`<textarea>`가 고정폭 형제 요소와 나란히 있는데 `min-w-0`이 없어 좁은 화면에서 넘치는 버그를 3건 찾았다. twin-choice의 모든 input(`CategoriesManager`/`ItemsManager`/`ChildrenManager`/`PhotoArchive`/`RoundView`)을 같은 기준으로 훑었으나 **전부 `w-full`로 단독 배치돼 있어 그 정확한 버그 패턴은 없었다.** `ConcessionChart`(주간 양보 추이, `src/components/ConcessionChart.tsx`)의 SVG 막대는 이미 자녀 수에 따라 폭이 동적으로 계산되고 `overflow-x-auto`로 감싸져 있어 reading-buddy가 겪었던(고정 `w-3` 픽셀 막대) 문제 자체가 없었지만, 범례(`flex gap-4`)는 자녀가 늘어나면 줄바꿈 없이 옆으로 넘칠 수 있어 예방 차원에서 `flex-wrap` 한 줄만 추가했다(실제 신고된 버그는 아님).

**이번에 보류한 것(Tier 2, 필요시 별도 요청)**: 부모 화면 태블릿/PC 반응형 확장(reading-buddy가 `.app-shell` 고정폭을 부모 화면부터 단계적으로 넓힌 것과 동일 구조가 twin-choice에도 있지만, 화면별 그리드 재조정이 필요한 별도 프로젝트급 작업), CLAUDE.md → ARCHITECTURE/BRIEF/STORIES 문서 분리(순수 문서 작업, 사용자 선호 확인 필요).

**검증 한계**: 이 세션 환경에 `.env.local`(실제 Supabase 키)이 없어 `npm run dev`로 PIN 로그인/잠금 흐름을 실제 브라우저로 끝까지 확인하지 못했다 — `npm run test`(25개 전부 통과) + `npx tsc --noEmit`(에러 없음)으로만 검증했다. **사용자가 실제 환경에서 `/login/child` PIN 확인 버튼 흐름과 5회 실패 잠금을 직접 확인하고, Supabase SQL Editor에서 `0013_pin_lockout.sql`을 실행해야 한다.**

**후속: 실제 배포 사이트로 검증 + CHILD_AUTH_SECRET 분실/재발급 (2026-09-13, 같은 날)**

위 항목들을 실제로 검증하려고 `vercel link` + `vercel env pull`로 프로덕션 환경변수를 로컬에 받아왔는데, `CHILD_AUTH_SECRET`/`SUPABASE_SERVICE_ROLE_KEY`가 Vercel에 "Sensitive"로 등록돼 있어 **소유자도 CLI로 다시 못 읽어온다**는 걸 이번에 처음 확인했다(값을 아는 사람이 아무도 없으면 원본이 영구히 사라지는 구조 — `openssl rand -hex 32`로 만들어 Vercel에만 넣고 따로 저장해두지 않았던 게 이번에 실제로 문제가 됨). `SUPABASE_SERVICE_ROLE_KEY`는 Supabase 대시보드에서 다시 볼 수 있어 해결됐지만, `CHILD_AUTH_SECRET`은 사용자도 저장해둔 곳이 없어 **분실 확정** — 새로 생성하기로 결정함.

- 이 값을 바꾸면 PIN→비밀번호 파생 결과가 전부 달라져서, **이미 만들어진 모든 자녀 계정의 로그인이 한꺼번에 끊긴다**(가족이 몇 개든 예외 없음). 실제로 이 프로젝트엔 데모 가족 외에 진짜 가족 2개(가족 코드는 CLAUDE.md에 남기지 않음)가 있었고, 그중 하나는 사용자가 개발 중 만든 테스트 계정(자녀 "첫째테스트"/"둘째테스트")이었다.
- 새 시크릿으로 교체(Vercel Production/Preview 환경변수 갱신 + 재배포)한 뒤, PIN을 알고 있는 계정만 복구했다: 데모 가족(PIN 1111/2222, 공개된 값)과 실제 가족의 자녀 2명(사용자가 현재 PIN을 직접 알려줌)의 Supabase Auth 비밀번호를 새 시크릿 기준으로 재계산해 `admin.auth.admin.updateUserById()`로 갱신. **"첫째테스트"/"둘째테스트"는 사용자가 "신경 안 써도 된다"고 확인해 복구하지 않고 그대로 뒀다** — 필요해지면 그 프로필을 지우고 새로 만들면 된다(PIN을 몰라서 되살릴 방법 자체가 없음).
- 새 `CHILD_AUTH_SECRET` 값 자체는 이 문서나 어떤 대화 로그에도 남기지 않는다 — Vercel Production/Preview 환경변수(Sensitive)와 사용자의 로컬 `.env.local`에만 있다. **이번 일의 교훈: 이런 서버 전용 랜덤 시크릿은 생성한 즉시 비밀번호 매니저 등 사용자 본인이 접근 가능한 곳에 별도로 백업해둘 것 — Vercel Sensitive 변수는 쓰기 전용이라 잃어버리면 재발급(=기존 계정 전체 재설정) 외엔 복구 방법이 없다.**
- 검증: `signInWithPassword`를 anon 키로 직접 호출해 데모 첫째/황유니/고아린 세 계정 전부 새 시크릿 기준 비밀번호로 실제 로그인 성공하는 것까지 확인함(스크립트는 검증 후 삭제, 서비스 롤 키를 코드베이스에 남기지 않음).

### AI 패턴 관찰 리포트 (Phase 2, 4번 — 프레이밍 원칙 확정)

**목적**: 부모가 쌓인 선택·양보 데이터를 보고 "우리 아이가 정서적으로 건강하게 크고 있는지" 감을 잡도록 돕는다. 앱의 1차 목표는 여전히 아이들의 재사용(게임성)이고, 이 기능은 그 데이터를 부모 쪽에서 부가적으로 해석해주는 것일 뿐 — 아이들 경험을 감시처럼 느껴지게 만들면 안 된다.

**절대 원칙 (프레이밍) — 구현 시 반드시 지킬 것**:

1. **진단적 언어 금지.** "심리 분석", "정상범위", "부모 개입이 필요합니다" 같은 임상/진단처럼 들리는 표현을 쓰지 않는다. 대신 "관찰 요약"으로 프레이밍한다 — 예: "최근 2주간 OO가 8번 중 6번 양보했어요" 같은 사실 나열 위주. 이 앱의 데이터(장난감·과자 선택 몇 번)로 아이의 심리를 판정할 근거는 없다는 걸 항상 전제한다.
2. **디스클레이머 상시 표시.** 모든 리포트 화면에 "이건 심리 평가가 아니에요. 계속 마음에 걸리면 전문가와 상담해보세요" 같은 문구를 빠짐없이 노출한다.
3. **자녀 화면 노출 절대 금지.** 기존 "양보 지수·통계는 자녀에게 절대 노출 금지" 원칙과 동일 선상 — 컴포넌트 자체를 자녀 role 트리에 마운트하지 않는다.
4. **최소 표본 이하면 리포트 자체를 생성하지 않는다.** 라운드 수가 적을 때 성급하게 패턴을 단정하지 않도록, 임계치(예: 최근 N주 내 조율 라운드 M회 이상) 미만이면 "아직 데이터가 부족해요"만 보여준다.
5. **저빈도·풀(pull) 노출만.** 부모가 대시보드에 직접 들어갔을 때만 보여주고, 푸시 알림처럼 경고를 밀어붙이지 않는다.
6. **성격/기질 라벨링 금지.** "우리 아이는 소극적이에요" 식으로 아이 개인을 규정하는 문장을 만들지 않는다. 행동의 빈도·추세만 서술하고, 해석과 판단은 부모의 몫으로 남긴다.
7. **AI 호출은 명시적 트리거로만.** 사진 AI 분석과 동일한 원칙 — 부모가 버튼을 눌렀을 때만 호출하고 자동 실행하지 않는다.
8. 위 원칙(1, 6 특히)은 실제 프롬프트 설계 시 시스템 프롬프트에 명시적 제약으로 넣어야 하고, 출력에 금지된 표현이 섞이지 않는지 확인하는 절차가 필요하다.

**기술 방향(구현됨)**: 사진 AI 분석과 동일하게 Azure OpenAI를 쓴다(Claude API 아님 — Anthropic 대신 Azure로 이미 통일된 결정과 일관성 유지). 최근 N개 라운드의 선택/양보 로그가 아니라 **이미 집계된 수치만** 프롬프트에 넣는다(원본 선택 내용은 절대 안 보냄). RLS 상 자녀도 resolutions 개별 row는 읽을 수 있지만, 집계·AI 호출은 `role='parent'` 를 확인하는 API 라우트에서만 이뤄진다.

**번외: "전문가 AI로 학습" 요청에 대한 결정 — "소아 전문 AI"/"놀이 전문 AI"처럼 도메인별로 다른 모델을 붙이거나 파인튜닝해달라는 요청이 있었으나, (a) 이 앱 규모에서 검증된 아동발달 학습 데이터를 확보할 방법이 없고 (b) 실제로는 같은 범용 모델에 프롬프트만 다듬는 것뿐인데 "전문가"라고 이름 붙이면 위 원칙 2번(디스클레이머)이 막으려는 바로 그 "과장된 권위 부여"가 된다고 판단해 거절했다. 대신 `generateObservationSummary`/`generateStartPrioritySuggestion`(`src/lib/azureOpenAI.ts`)이 공유하는 `CHILD_LANGUAGE_PRINCIPLES` 배열에 실제 아동발달 커뮤니케이션 원칙을 반영해 프롬프트 자체를 더 정교하게 만들었다: 형제 비교 금지(Faber & Mazlish), 행동과 정체성 분리(Dweck의 성장 마인드셋), 제안형 어투로 자율성 지지(Deci & Ryan). "전문가 AI"라는 라벨은 UI/문서 어디에도 쓰지 않는다 — 여전히 "관찰 요약"/"제안" 정도의 겸손한 프레이밍 유지. `observationSafety.ts`의 금지어 필터에도 비교·트레이트 라벨링 표현("더 착해", "이기적이다" 등)을 2차 방어선으로 추가.

## 데이터 모델

```sql
families(id, name, created_at)
profiles(id, family_id, role[parent|child], name, avatar, avatar_photo_path[nullable], pin_hash, created_at)
  -- avatar_photo_path 있으면 그 사진을, 없으면 avatar 이모지를 보여준다(UI 폴백, src/components/Avatar.tsx).
categories(id, family_id, name, emoji, is_active)
items(id, category_id, name, emoji, is_active)
rounds(id, family_id, category_id, started_by, status[waiting|revealed|resolved], expected_participants,
       ai_matched[nullable bool], created_at)
  -- ai_matched: 공개 시점 AI 비교 결과 캐시. 그리드끼리만이면 계산할 필요 없이 null로 남아도 되고
  -- (클라이언트가 item_id로 바로 비교), 사진이 끼어 AI 비교를 한 번 거쳤다면 true/false로 고정된다.
choices(id, round_id, profile_id, item_id[nullable], label[nullable], photo_id[nullable → photos], submitted_at)
  -- item_id 또는 label 중 최소 하나는 있어야 한다(그리드 선택 vs 사진/자유 입력 선택).
resolutions(id, round_id, type[roulette|turn|both|manual|match], winner_profile_id, conceded_profile_id, resolved_at)
photos(id, family_id, profile_id, round_id, item_id, storage_path, ai_category, ai_label, confirmed, created_at)
  -- Phase 1부터 "사진으로 고르기"에서 실제로 쓰임. 찍을 때마다 row가 생기고(재촬영해도 새 row),
  -- 최종 제출된 선택이 choices.photo_id로 그 중 하나를 가리킨다.
  -- 부모가 이 사진들을 모아보는 갤러리 UI는 Phase 2.
push_subscriptions(id, family_id, profile_id, endpoint[unique], p256dh, auth, created_at)
  -- Web Push 구독. endpoint 는 기기 단위라 전역 유니크 — 같은 기기를 형제가 돌려쓰면
  -- 재구독한 사람이 소유권을 가져간다(upsert on endpoint).
```

Storage: `photos` 버킷(비공개). 경로 규칙 `{family_id}/{profile_id}/{round_id}-{timestamp}.ext`, RLS는 경로의 family_id/profile_id 세그먼트를 `auth.uid()` 기반 헬퍼 함수와 대조해서 검사(`supabase/migrations/0004_photos_storage.sql`).

Storage: `avatars` 버킷(비공개, 프로필 사진). 경로 규칙 `{family_id}/{profile_id}.jpg` — 프로필당 한 장, 재업로드시 upsert로 덮어씀. `photos`와 달리 블라인드 대상이 아니라 family 구성원이면 항상 조회 가능, 쓰기는 부모만(`0008_child_avatar_photos.sql`).

RLS 정책 예시 방향(의사코드):
- `profiles`: 자신의 `family_id` row만 SELECT
- `choices`, `rounds`: 같은 `family_id`의 부모·자녀 모두 SELECT/INSERT 가능(단, 상대가 제출하기 전까지는 `item_id`를 마스킹해서 반환하는 뷰 또는 API 레벨 필터 필요 — 블라인드 유지)
- `photos`: `choices`와 동일한 블라인드 규칙 — 본인 사진은 항상 보이고, 상대 사진은 라운드가 `waiting`을 벗어난 뒤에만 보인다. family 스코프만 걸고 라운드 상태를 안 보면 "사진으로 고르기" 쓸 때 블라인드가 새는 사고가 났었다(`0005_freeform_photo_choices.sql`에서 수정).
- `categories`/`items`: SELECT는 family 구성원 누구나, INSERT/UPDATE는 `role='parent'` + family 스코프만(`0006_category_customization.sql`) — 커스터마이징은 부모 전용.
- `photos` UPDATE(라벨 수정): `role='parent'` + family 스코프만(`0007_photo_archive.sql`). SELECT는 기존 블라인드 정책 그대로.
- 양보 지수 집계는 별도 테이블 없이 `resolutions`/`rounds`를 그때그때 서버 컴포넌트에서 계산(`src/lib/concessionStats.ts`). **집계 결과는 행 단위 RLS로 못 숨기므로 반드시 role='parent' 확인 후 서버에서 계산하고 클라이언트로는 계산된 결과만 내려줄 것.**
- `profiles` UPDATE: `role='parent'` + family 스코프(`0008_child_avatar_photos.sql`에서 처음 오픈). RLS는 행 단위까지만 막을 수 있어서, `role`/`pin_hash`/`family_id` 같은 민감 컬럼까지 열리지 않도록 컬럼 단위 GRANT로 `avatar`/`avatar_photo_path` 두 필드만 UPDATE 가능하게 추가로 좁혔다.

## 참고 문서 (개발 착수 전 합의된 내용)

- **PRD**: 전체 요구사항, User Story, Success Metrics — https://claude.ai/code/artifact/b739e38e-055f-464f-b350-2a98213d2384
- **개발 착수 전 결정 사항**: 배포형태·비용정책·확장성 설계의 근거 — https://claude.ai/code/artifact/c3811163-c11d-4f9a-a14b-0d6e8c99f8a9
- **기존 프로토타입**: 블라인드 선택/조율 UI·로직의 1차 검증 버전(브라우저 저장소 기반, 정식 인증 없음). 이 프로젝트에 `reference/` 폴더로 복사해두고 UI·상태 흐름 참고용으로만 사용 — 저장 로직은 Supabase로 전면 교체.

## 코딩 시 주의사항

1. **양보 지수·통계는 자녀 화면 어디에도 절대 노출하지 말 것.** 컴포넌트 트리 상에서도 자녀 role일 때 해당 컴포넌트가 아예 마운트되지 않아야 함 (조건부 `display:none`이 아니라 렌더링 자체를 스킵). **예외(의도된 결정)**: `/history`(기록) 화면만은 예외다 — 이 원칙과 충돌한다는 걸 사용자에게 명시적으로 알린 뒤, 그걸 알고도 "자녀 화면에도 그대로 추가"를 선택했다. 그래서 `HistoryView.tsx`(라운드별 조율 종류 + 승자 표시)와 `PrioritySuggestion.tsx`("이번엔 누구 차례?" AI 제안, `/api/history/priority-suggestion`)는 부모/자녀 공용이며 역할 제한이 없다 — `/settings/dashboard`의 `ObservationReport`(누적 %·그래프, 부모 전용)와는 별개로 취급할 것. 새 통계·집계 기능을 만들 때 이 예외를 이유로 원칙 1을 임의로 더 넓히지 말 것 — `/history` 확장은 딱 한 번 명시적으로 승인된 결정이다.
2. **블라인드 유지**: 상대방이 제출하기 전, API 응답에 상대 선택 데이터를 절대 포함시키지 말 것(프론트에서 숨기는 방식 금지 — 응답 자체에서 제외).
3. 사진 촬영 화면에는 "사람 없이 물건만 찍어주세요" 안내 문구를 항상 노출할 것 (Phase 1 "사진으로 고르기"부터 실사용됨).
4. 새 마이그레이션 작성 시 `family_id` 없는 테이블을 추가하지 말 것.
5. **사진으로 고른 선택은 항목 목록에 끼워맞추지 않는다.** `item_id`는 null로 두고 AI가 만든 자유 라벨(또는 자녀가 직접 입력한 라벨)을 `choices.label`에 저장한다. "같은 걸 골랐는지"는 공개 시점에 `/api/rounds/[id]/compare`가 판정하고, 그 결과(`rounds.ai_matched`)를 캐싱해 두 자녀가 각자 다시 계산하지 않게 한다.
6. AI가 제안한 라벨은 자녀가 명시적으로 확인(맞아요)해야 `choices`에 제출된다. confidence가 낮으면 확인 단계 없이 바로 자녀가 직접 라벨을 입력하게 한다 — AI 응답을 확인 없이 자동으로 제출하지 말 것.
7. 폰카메라 사진은 원본을 그대로 올리지 말 것. Vercel 서버리스 함수의 요청 본문 크기 제한(~4.5MB)에 걸리고 느려진다 — 브라우저에서 축소(최대 1024px)+재압축(JPEG) 후 업로드한다(`src/lib/imageResize.ts`).
8. 항목 탭처럼 실패 가능성이 낮은 제출 액션은 낙관적 업데이트(먼저 화면을 넘기고 실패하면 되돌리기)로 처리해 네트워크 왕복 시간만큼 "느리게" 느껴지지 않게 한다.
