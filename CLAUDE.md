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
