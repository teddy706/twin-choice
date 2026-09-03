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
- [ ] **4. AI 패턴 관찰 리포트** — 3번의 집계 인프라 위에 얹는다. 프레이밍 원칙(아래)은 이미 확정, 구현만 남음.
- [ ] **5. 푸시 알림** — VAPID 키, 구독 저장 테이블, 서비스워커 push 이벤트가 새로 필요. 다른 항목과 성격이 달라 제일 마지막.

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

**기술 방향(가안)**: Claude API에 최근 N개 라운드의 선택/양보 로그(집계된 수치)를 넘겨 위 원칙을 강제한 프롬프트로 관찰 요약 텍스트를 생성. RLS 상으로도 이 데이터는 `role='parent'`만 SELECT 가능해야 한다(기존 `concession_logs`/`analytics_*` 방향과 동일).

## 데이터 모델

```sql
families(id, name, created_at)
profiles(id, family_id, role[parent|child], name, avatar, pin_hash, created_at)
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
```

Storage: `photos` 버킷(비공개). 경로 규칙 `{family_id}/{profile_id}/{round_id}-{timestamp}.ext`, RLS는 경로의 family_id/profile_id 세그먼트를 `auth.uid()` 기반 헬퍼 함수와 대조해서 검사(`supabase/migrations/0004_photos_storage.sql`).

RLS 정책 예시 방향(의사코드):
- `profiles`: 자신의 `family_id` row만 SELECT
- `choices`, `rounds`: 같은 `family_id`의 부모·자녀 모두 SELECT/INSERT 가능(단, 상대가 제출하기 전까지는 `item_id`를 마스킹해서 반환하는 뷰 또는 API 레벨 필터 필요 — 블라인드 유지)
- `photos`: `choices`와 동일한 블라인드 규칙 — 본인 사진은 항상 보이고, 상대 사진은 라운드가 `waiting`을 벗어난 뒤에만 보인다. family 스코프만 걸고 라운드 상태를 안 보면 "사진으로 고르기" 쓸 때 블라인드가 새는 사고가 났었다(`0005_freeform_photo_choices.sql`에서 수정).
- `categories`/`items`: SELECT는 family 구성원 누구나, INSERT/UPDATE는 `role='parent'` + family 스코프만(`0006_category_customization.sql`) — 커스터마이징은 부모 전용.
- `photos` UPDATE(라벨 수정): `role='parent'` + family 스코프만(`0007_photo_archive.sql`). SELECT는 기존 블라인드 정책 그대로.
- 양보 지수 집계는 별도 테이블 없이 `resolutions`/`rounds`를 그때그때 서버 컴포넌트에서 계산(`src/lib/concessionStats.ts`). **집계 결과는 행 단위 RLS로 못 숨기므로 반드시 role='parent' 확인 후 서버에서 계산하고 클라이언트로는 계산된 결과만 내려줄 것.**

## 참고 문서 (개발 착수 전 합의된 내용)

- **PRD**: 전체 요구사항, User Story, Success Metrics — https://claude.ai/code/artifact/b739e38e-055f-464f-b350-2a98213d2384
- **개발 착수 전 결정 사항**: 배포형태·비용정책·확장성 설계의 근거 — https://claude.ai/code/artifact/c3811163-c11d-4f9a-a14b-0d6e8c99f8a9
- **기존 프로토타입**: 블라인드 선택/조율 UI·로직의 1차 검증 버전(브라우저 저장소 기반, 정식 인증 없음). 이 프로젝트에 `reference/` 폴더로 복사해두고 UI·상태 흐름 참고용으로만 사용 — 저장 로직은 Supabase로 전면 교체.

## 코딩 시 주의사항

1. **양보 지수·통계는 자녀 화면 어디에도 절대 노출하지 말 것.** 컴포넌트 트리 상에서도 자녀 role일 때 해당 컴포넌트가 아예 마운트되지 않아야 함 (조건부 `display:none`이 아니라 렌더링 자체를 스킵).
2. **블라인드 유지**: 상대방이 제출하기 전, API 응답에 상대 선택 데이터를 절대 포함시키지 말 것(프론트에서 숨기는 방식 금지 — 응답 자체에서 제외).
3. 사진 촬영 화면에는 "사람 없이 물건만 찍어주세요" 안내 문구를 항상 노출할 것 (Phase 1 "사진으로 고르기"부터 실사용됨).
4. 새 마이그레이션 작성 시 `family_id` 없는 테이블을 추가하지 말 것.
5. **사진으로 고른 선택은 항목 목록에 끼워맞추지 않는다.** `item_id`는 null로 두고 AI가 만든 자유 라벨(또는 자녀가 직접 입력한 라벨)을 `choices.label`에 저장한다. "같은 걸 골랐는지"는 공개 시점에 `/api/rounds/[id]/compare`가 판정하고, 그 결과(`rounds.ai_matched`)를 캐싱해 두 자녀가 각자 다시 계산하지 않게 한다.
6. AI가 제안한 라벨은 자녀가 명시적으로 확인(맞아요)해야 `choices`에 제출된다. confidence가 낮으면 확인 단계 없이 바로 자녀가 직접 라벨을 입력하게 한다 — AI 응답을 확인 없이 자동으로 제출하지 말 것.
7. 폰카메라 사진은 원본을 그대로 올리지 말 것. Vercel 서버리스 함수의 요청 본문 크기 제한(~4.5MB)에 걸리고 느려진다 — 브라우저에서 축소(최대 1024px)+재압축(JPEG) 후 업로드한다(`src/lib/imageResize.ts`).
8. 항목 탭처럼 실패 가능성이 낮은 제출 액션은 낙관적 업데이트(먼저 화면을 넘기고 실패하면 되돌리기)로 처리해 네트워크 왕복 시간만큼 "느리게" 느껴지지 않게 한다.
