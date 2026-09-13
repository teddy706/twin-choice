# 따로 또 같이 (twin-choice)

일란성 쌍둥이(및 형제자매) 자녀가 영상·과자·장난감 등을 고를 때, 상대 선택을 보기 전에 각자 블라인드로 먼저 고르고 → 동시 공개 → 다르면 정해진 조율 도구로 해결하는 가족용 PWA. 부모는 그 기록으로 각 아이의 진짜 취향과 양보 패턴을 데이터로 파악한다.

전체 요구사항은 [docs/PRD.md](docs/PRD.md), 5분 요약은 [docs/BRIEF.md](docs/BRIEF.md) 참고. 자매 앱 `reading-buddy`(같은 쌍둥이 자녀 대상 독서 기록 앱)와 인증/프로필 스키마를 공유하며 서로 개선 사항을 역이식하는 관계다.

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router) + TypeScript + Tailwind CSS, 모바일 웹(PWA)
- **백엔드/API**: Next.js API 라우트(`src/app/api/**`) — 별도 서버리스 함수 플랫폼 없음
- **DB/인증/스토리지/실시간**: Supabase (Postgres, Auth, Storage, Realtime) — 무료 티어
- **AI**: Azure OpenAI(`gpt-4o` — 사진 라벨링/비교/AI 관찰 요약/우선순위 제안), Azure AI Speech(음성 인식) — 자매 프로젝트 `reading-buddy`의 기존 리소스를 재사용 중(자세한 배경은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 7절)
- **푸시 알림**: Web Push(VAPID)
- **배포**: Vercel (아래 "배포" 섹션 참고)

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run dev
```

### 테스트

```bash
npm run test         # 한 번 실행
npm run test:watch   # watch 모드
```

외부 의존성(Supabase/Azure 등) 없이 순수하게 계산만 하는 로직(PIN 검증/잠금, 양보 지수 집계,
AI 출력 금지어 필터, 가족 코드 생성, 타일 색상 배정)만 유닛 테스트(`src/lib/*.test.ts`)로
다루고, Next.js 서버 컴포넌트/API 라우트/RLS 같은 통합 동작은 실제 브라우저로 수동 검증한다
(CLAUDE.md 각 항목 기록 참고). 현재 5개 파일 25개 테스트. `server-only`로 막힌 모듈을
테스트에서 import할 수 있도록 `vitest.config.mts`가 그 패키지를 빈 모듈
(`test/stubs/server-only.ts`)로 치환해둔다.

### Supabase 셋업

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (무료 티어).
2. 프로젝트 설정 > API 에서 URL과 anon key를 `.env.local`에 복사.
   **service role key는 반드시 "Legacy anon, service_role API keys" 탭의 JWT를 사용할 것** —
   새 형식 secret key(`sb_secret_...`)는 GoTrue admin API에는 동작하지만 PostgREST의 RLS
   우회(`admin.from(...).insert` 등)에는 `role=service_role` JWT가 필요해서 동작하지 않는다.
3. `supabase/migrations/*.sql`을 **번호 순서대로** SQL Editor에서 실행:
   - `0001_schema.sql` — families/profiles + 선택 기록 도메인 테이블
   - `0002_functions_triggers.sql` — RLS 헬퍼 함수
   - `0003_rls.sql` — Row Level Security 정책
   - `0004_photos_storage.sql` — "사진으로 고르기"용 비공개 스토리지 버킷
   - `0005_freeform_photo_choices.sql` — 사진 선택을 고정 매칭에서 자유 비교 방식으로 전환
   - `0006_category_customization.sql` — 부모의 카테고리/항목 커스터마이징 RLS
   - `0007_photo_archive.sql` — 사진 아카이브 라벨 수정 RLS
   - `0008_child_avatar_photos.sql` — 자녀 얼굴 사진 아바타용 스토리지 버킷
   - `0009_push_notifications.sql` — Web Push 구독 테이블
   - `0010_enable_realtime.sql` — Realtime publication 활성화(버그 수정)
   - `0011_one_waiting_round_per_category.sql` — 동시 라운드 생성 중복 방지(버그 수정)
   - `0012_choice_reason.sql` — "왜 이게 좋아?" 음성 이유 텍스트 컬럼
   - `0013_pin_lockout.sql` — 자녀 PIN 5회 실패 잠금용 컬럼
4. `CHILD_AUTH_SECRET`은 `openssl rand -hex 32`로 생성 — **생성 즉시 비밀번호 매니저 등에 별도로 백업해둘 것.** Vercel의 "Sensitive" 환경변수로 등록하면 소유자도 나중에 CLI로 다시 못 읽어오고, 이 값을 바꾸면 이미 만들어진 모든 자녀 계정의 로그인이 한꺼번에 끊긴다(상세: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 12절).

### Azure 셋업

두 개가 필요하다(전부 텍스트/비전 모델은 배포 가능한 리전이면 무방하나, 아래 "주의" 참고):

1. **Azure OpenAI**: 비전+function calling을 지원하는 모델(`gpt-4o` 등)을 배포. Foundry
   포털(`ai.azure.com`)의 "모델 배포"에서 진행. `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_API_KEY`/
   `AZURE_OPENAI_DEPLOYMENT`에 반영.
2. **Azure AI Speech**: 음성 인식(STT)용. `AZURE_SPEECH_REGION`(리전 슬러그, 예: `koreacentral`)/
   `AZURE_SPEECH_KEY`에 반영.

**주의 — Whisper는 안 쓴다**: 음성 인식에 Azure OpenAI의 Whisper 모델이 아니라 Azure AI Speech를
쓴다. Whisper 등 오디오 계열 모델은 텍스트/비전 모델보다 배포 가능 리전이 훨씬 좁아서, 원하는
리전에 기존 Azure OpenAI 리소스가 있어도 Whisper는 배포 목록에 안 뜰 수 있다 — 그때는 Azure AI
Speech 리소스를 별도로 하나 더 만들면 된다(비용은 사용량 기반, 별도 상시 비용 없음).

Vercel에 배포 중이라면 위 키들을 Vercel 프로젝트의 Environment Variables에도 추가해야
프로덕션에 반영된다.

### 배포 (Vercel)

**프로덕션**: https://twin-choice-ten.vercel.app (Vercel 프로젝트 `teddy706s-projects/twin-choice`)

1. [vercel.com/new](https://vercel.com/new) → GitHub의 `twin-choice` 저장소 Import (Next.js 자동 인식)
2. "Environment Variables"에 `.env.local`의 모든 변수를 등록 (Production and Preview 스코프)
3. Deploy. 이후 `main` 브랜치에 push할 때마다 Vercel이 자동으로 재배포함
4. `vercel.json`의 `regions: ["icn1"]`(서울)이 Supabase 리전과 맞는지 확인 — 다르면 API 호출마다
   불필요한 지역 간 왕복이 생겨 체감 속도가 느려진다

### 인증 구조 (중요)

Supabase Auth로 로그인하는 건 **부모뿐**이다. 자녀는 부모 로그인 세션 없이 가족 코드+PIN으로
프로필을 전환하지만, 내부적으로는 `child+{profileId}@child.twin-choice.internal` 형태의
synthetic 계정으로 실제 Supabase Auth 세션을 발급받는다(`src/lib/childAuth.ts`). 그래야
`auth.uid()` 기반 RLS가 "같은 가족인가"뿐 아니라 "쌍둥이 중 누구의 프로필인가"까지 DB 레벨에서
강제된다. 자세한 배경은 [CLAUDE.md](CLAUDE.md)와 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 4절 참고.

## 프로젝트 구조

```
src/
  middleware.ts        모든 요청에서 Supabase 세션 쿠키 갱신
  app/
    login/              /login, /login/parent, /login/child, /signup
    home/                자녀·부모 공용 홈
    round/new, round/[id]  카테고리 선택 → 블라인드 선택 → 공개 → 조율
    history/             기록(자녀/부모 공용) + "이번엔 누구 차례?" AI 제안
    settings/            부모 전용 — children/categories/photos/dashboard
    demo/                해커톤 심사용 데모 안내(제품 기능 아님)
    api/                 Next.js API 라우트로 통일된 백엔드(auth, children, rounds, dashboard,
                         history, push)
  components/           화면별 클라이언트 컴포넌트(RoundView.tsx가 핵심 흐름 대부분을 담당)
  lib/
    supabase/            client.ts(브라우저) / server.ts(RSC) / admin.ts(service role)
    childAuth.ts          자녀 PIN → synthetic 계정 인증, 잠금 판정
    azureOpenAI.ts        사진 라벨링/비교/AI 관찰 요약/우선순위 제안
    azureSpeech.ts / pcmRecorder.ts  음성 인식(서버) / 마이크 녹음 인코딩(클라이언트)
    concessionStats.ts    양보 지수 집계
    observationSafety.ts  AI 출력 금지어 필터
    *.test.ts             유닛 테스트
supabase/
  migrations/            SQL 마이그레이션(번호 순서대로 적용)
docs/
  PRD.md                 제품 요구사항 문서(원본 계획 + 구현 노트)
  ARCHITECTURE.md        실제 구현 기준 기술 아키텍처
  BRIEF.md               프로젝트 5분 요약
  STORIES.md             기능 단위 사용자 스토리(전부 구현 완료 상태)
scripts/
  seed-demo-family.ts    해커톤 데모 가족 시딩(`npm run seed:demo`)
```

## 현재 상태

**Phase 1(MVP)**과 **Phase 2(카테고리 커스터마이징/사진 아카이브/부모 대시보드/AI 관찰
리포트/푸시 알림/자녀 프로필 사진, 6개 항목)** 전부 구현·실제 브라우저 검증 완료. 이후
"왜 이게 좋아?" 음성 이유 남기기, 해커톤 데모 진입점, 비주얼 리디자인이 추가됐고, 자매 앱
`reading-buddy`의 개선 사항(PIN 확인 버튼, PIN 잠금, 성능 최적화, 유닛 테스트 인프라)을
역이식했다. 가장 최근에는 삭제된 Azure OpenAI 리소스를 `reading-buddy`의 기존 리소스로
대체하고, 그 과정에서 발견한 AI 실패 시 핵심 흐름이 멈추던 버그들을 함께 수정했다.

세부 구현·검증 이력은 저장소 루트의 [CLAUDE.md](CLAUDE.md)가 살아있는 소스로 관리한다. 기능
단위 상세는 [docs/STORIES.md](docs/STORIES.md), 기술 구조는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 참고.
