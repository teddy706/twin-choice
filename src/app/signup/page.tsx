"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentName, setParentName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, parentName, familyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "회원가입에 실패했어요.");
        return;
      }
      setJoinCode(data.joinCode);
    } finally {
      setLoading(false);
    }
  }

  if (joinCode) {
    return (
      <div className="app-shell justify-center">
        <div className="card text-center">
          <div className="mb-2 text-4xl">🎉</div>
          <h2 className="mb-2 text-lg font-bold">가입 완료!</h2>
          <p className="mb-3 text-sm text-soft">
            우리 가족 코드예요. 자녀 로그인 화면에서 이 코드를 입력하면 프로필을 고를 수 있어요.
          </p>
          <div className="mb-4 rounded-2xl bg-accent/10 py-4 text-3xl font-extrabold tracking-[0.3em] text-accent">
            {joinCode}
          </div>
          <button className="btn btn-primary" onClick={() => router.push("/home")}>
            시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <h1 className="mb-1 mt-1 text-center text-2xl font-bold">부모 회원가입</h1>
      <p className="mb-6 text-center text-sm text-soft">가족 계정을 만들어요</p>

      <form className="card" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="내 이름 (예: 엄마)"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          required
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-[15px]"
        />
        <input
          type="text"
          placeholder="가족 이름 (선택, 예: 우리집)"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-[15px]"
        />
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-[15px]"
        />
        <input
          type="password"
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-[15px]"
        />
        {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mb-0" disabled={loading}>
          {loading ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-soft">
        이미 계정이 있으신가요? <Link href="/login/parent" className="font-bold text-accent underline">로그인</Link>
      </p>
    </div>
  );
}
