import Link from "next/link";

// 해커톤 심사용 데모 진입점. 회원가입 없이 고정된 "체험용 가족"으로 핵심 흐름(블라인드 선택 →
// 동시 공개 → 조율)과 부모 대시보드(AI 관찰 요약 포함)를 바로 체험할 수 있게 안내한다.
// 실제 제품 기능이 아니라 제출용 임시 장치 — CLAUDE.md "번외" 섹션 참고. 로그인 페이지들의
// 기존 상태 로직은 전혀 건드리지 않고, 여기서는 가족 코드/PIN/계정 정보만 보여준다.

const FAMILY_CODE = "DEMO26";
const CHILD_1 = { label: "🐰 첫째로 체험하기", pin: "1111" };
const CHILD_2 = { label: "🐻 둘째로 체험하기", pin: "2222" };
const PARENT_EMAIL = "demo-judge@twin-choice.internal";
const PARENT_PASSWORD = "TwinDemo2026!";

export default function DemoPage() {
  return (
    <div className="app-shell">
      <h1 className="mb-1 mt-1 text-center text-2xl font-bold">🎬 심사용 데모</h1>
      <p className="mb-6 text-center text-sm text-soft">
        쌍둥이·형제자매가 뭔가를 고를 때 서로 눈치 보며 양보하는 걸 줄이려고,
        <br />
        상대 선택을 보기 전에 각자 블라인드로 먼저 고르게 하는 앱이에요.
      </p>

      <div className="card">
        <p className="mb-2 text-sm font-bold">1. 가족 코드</p>
        <p className="mb-3 select-all rounded-2xl border-2 border-[#f0f0f0] bg-[#fafafa] px-4 py-3 text-center text-2xl font-bold tracking-[0.2em]">
          {FAMILY_CODE}
        </p>
        <p className="text-xs text-soft">
          ⚠️ 같은 브라우저의 일반 탭들은 로그인 세션을 공유해서, 한쪽에 로그인하면 다른 쪽도 자동으로 바뀌어요.
          <br />
          실제 쌍둥이처럼 동시에 체험하려면 <b>창 1개(일반) + 창 1개(시크릿/프라이빗)</b> 또는{" "}
          <b>서로 다른 브라우저 2개</b>를 써주세요.
        </p>
      </div>

      <div className="card">
        <p className="mb-3 text-sm font-bold">2. 자녀로 체험하기 (창 2개)</p>
        <Link href="/login/child" target="_blank" className="btn btn-a">
          {CHILD_1.label}
        </Link>
        <p className="mb-3 text-center text-xs text-soft">일반 창에서: 가족 코드 {FAMILY_CODE} 입력 → 프로필 선택 → PIN {CHILD_1.pin}</p>
        <Link href="/login/child" target="_blank" className="btn btn-b mb-0">
          {CHILD_2.label}
        </Link>
        <p className="mt-3 text-center text-xs text-soft">시크릿 창에서: 가족 코드 {FAMILY_CODE} 입력 → 프로필 선택 → PIN {CHILD_2.pin}</p>
      </div>

      <div className="card">
        <p className="mb-3 text-sm font-bold">3. 부모로 체험하기 (대시보드 · AI 관찰 요약)</p>
        <Link href="/login/parent" target="_blank" className="btn btn-outline mb-3">
          🧑‍🏫 부모 로그인 페이지 열기
        </Link>
        <p className="mb-1 text-xs text-soft">이메일: <span className="select-all font-mono">{PARENT_EMAIL}</span></p>
        <p className="text-xs text-soft">비밀번호: <span className="select-all font-mono">{PARENT_PASSWORD}</span></p>
        <p className="mt-3 text-xs text-soft">
          로그인 후 ⚙️ 설정 → 대시보드에서 양보 지수 그래프와 &ldquo;AI 관찰 요약&rdquo; 버튼을 눌러보세요
          (Azure OpenAI를 실시간으로 호출합니다).
        </p>
      </div>

      <p className="mt-2 text-center text-xs text-soft">
        데모 데이터이며 주기적으로 초기화될 수 있어요. 실제 가족 정보가 아닙니다.
      </p>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="font-bold text-accent underline">
          ← 로그인 화면으로
        </Link>
      </p>
    </div>
  );
}
