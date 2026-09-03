import Link from "next/link";

export default function LoginPickerPage() {
  return (
    <div className="app-shell">
      <h1 className="mb-1 mt-1 text-center text-2xl font-bold">👯 따로 또 같이</h1>
      <p className="mb-6 text-center text-sm text-soft">누가 들어갈까요?</p>

      <div className="card">
        <Link href="/login/child" className="btn btn-a">
          🧒 자녀예요
        </Link>
        <Link href="/login/parent" className="btn btn-outline mb-0">
          🧑 부모예요
        </Link>
      </div>

      <p className="mt-4 text-center text-sm text-soft">
        처음이신가요? <Link href="/signup" className="font-bold text-accent underline">부모 회원가입</Link>
      </p>
      <p className="mt-2 text-center text-xs text-soft">
        심사위원이신가요? <Link href="/demo" className="underline">데모 체험하기</Link>
      </p>
    </div>
  );
}
