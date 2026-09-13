"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ChildOption = { id: string; name: string; avatar: string };

const LAST_CODE_COOKIE = "twin_choice_family_code";

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function ChildLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"code" | "profile" | "pin">("code");
  const [joinCode, setJoinCode] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [selected, setSelected] = useState<ChildOption | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const remembered = readCookie(LAST_CODE_COOKIE);
    if (remembered) {
      setJoinCode(remembered);
      lookupFamily(remembered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupFamily(code: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/family-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "가족 코드를 찾을 수 없어요.");
        return;
      }
      writeCookie(LAST_CODE_COOKIE, data.joinCode);
      setFamilyId(data.familyId);
      setFamilyName(data.familyName);
      setChildren(data.children);
      setStep("profile");
    } finally {
      setLoading(false);
    }
  }

  async function submitPin(pinValue: string) {
    if (!selected || !familyId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/child-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, profileId: selected.id, pin: pinValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PIN이 맞지 않아요.");
        setPin("");
        return;
      }
      router.push("/home");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function onPinDigit(digit: string) {
    if (pin.length >= 4) return;
    setPin(pin + digit);
  }

  if (step === "code") {
    return (
      <div className="app-shell justify-center">
        <h1 className="mb-1 mt-1 text-center text-2xl font-bold">🧒 자녀 로그인</h1>
        <p className="mb-6 text-center text-sm text-soft">부모님이 알려준 가족 코드를 입력해주세요</p>
        <div className="card">
          <input
            type="text"
            placeholder="가족 코드 6자리"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="mb-2.5 w-full rounded-2xl border-2 border-[#eee] p-3.5 text-center text-xl font-bold tracking-[0.3em]"
          />
          {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
          <button
            className="btn btn-primary mb-0"
            disabled={loading || joinCode.length < 6}
            onClick={() => lookupFamily(joinCode)}
          >
            {loading ? "확인 중..." : "다음"}
          </button>
        </div>
        <Link href="/login" className="btn btn-ghost text-center">← 뒤로</Link>
      </div>
    );
  }

  if (step === "profile") {
    return (
      <div className="app-shell justify-center">
        <h1 className="mb-1 mt-1 text-center text-2xl font-bold">{familyName}</h1>
        <p className="mb-6 text-center text-sm text-soft">누구예요?</p>
        <div className="grid grid-cols-2 gap-3">
          {children.map((c) => (
            <div
              key={c.id}
              className="item-tile"
              onClick={() => {
                setSelected(c);
                setPin("");
                setStep("pin");
              }}
            >
              <span className="mb-1.5 block text-4xl">{c.avatar}</span>
              <span className="text-sm font-semibold">{c.name}</span>
            </div>
          ))}
        </div>
        {children.length === 0 && (
          <p className="mt-4 text-center text-sm text-soft">아직 등록된 자녀가 없어요. 부모님께 요청해주세요.</p>
        )}
        <button className="btn btn-ghost mt-4" onClick={() => setStep("code")}>← 다른 가족 코드</button>
      </div>
    );
  }

  return (
    <div className="app-shell justify-center">
      <h1 className="mb-1 mt-1 text-center text-2xl font-bold">
        {selected?.avatar} {selected?.name}
      </h1>
      <p className="mb-6 text-center text-sm text-soft">PIN 4자리를 눌러주세요</p>
      <div className="mb-6 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-accent" : "bg-[#eee]"}`}
          />
        ))}
      </div>
      {error && <p className="mb-3 text-center text-sm font-semibold text-red-500">{error}</p>}
      <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            className="rounded-2xl bg-white py-4 text-xl font-bold shadow-card active:scale-95"
            disabled={loading}
            onClick={() => onPinDigit(d)}
          >
            {d}
          </button>
        ))}
        <button
          className="rounded-2xl bg-transparent py-4 text-sm font-semibold text-soft"
          onClick={() => setStep("profile")}
        >
          취소
        </button>
        <button
          className="rounded-2xl bg-white py-4 text-xl font-bold shadow-card active:scale-95"
          disabled={loading}
          onClick={() => onPinDigit("0")}
        >
          0
        </button>
        <button
          className="rounded-2xl bg-transparent py-4 text-sm font-semibold text-soft"
          onClick={() => setPin(pin.slice(0, -1))}
        >
          ⌫
        </button>
      </div>
      <button
        className="btn btn-primary mx-auto mt-4 w-full max-w-[280px]"
        disabled={loading || pin.length !== 4}
        onClick={() => submitPin(pin)}
      >
        {loading ? "확인하는 중..." : "확인"}
      </button>
    </div>
  );
}
