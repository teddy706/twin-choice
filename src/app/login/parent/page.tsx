"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ParentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했어요.");
        return;
      }
      router.push("/home");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell justify-center">
      <h1 className="mb-1 mt-1 text-center text-2xl font-bold">🧑 부모 로그인</h1>
      <form className="card" onSubmit={onSubmit}>
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
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-[15px]"
        />
        {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary mb-0" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-soft">
        계정이 없으신가요? <Link href="/signup" className="font-bold text-accent underline">회원가입</Link>
      </p>
      <Link href="/login" className="btn btn-ghost text-center">← 뒤로</Link>
    </div>
  );
}
