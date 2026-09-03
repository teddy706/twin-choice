import Link from "next/link";
import { ChildIcon, ParentIcon } from "@/components/icons";

export default function LoginPickerPage() {
  return (
    <div className="app-shell">
      <h1 className="mb-1 mt-2 text-center font-display text-3xl">👯 따로 또 같이</h1>
      <p className="mb-7 text-center text-sm font-bold text-soft">누가 들어갈까요?</p>

      <div className="flex flex-col gap-3.5">
        <Link
          href="/login/child"
          className="flex items-center gap-3.5 rounded-card border-2 border-ink bg-a-tile p-5 transition-transform active:scale-[0.98]"
        >
          <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl border-2 border-ink bg-white">
            <ChildIcon size={28} />
          </span>
          <span>
            <span className="block text-[19px] font-extrabold">자녀예요</span>
            <span className="block text-xs font-medium text-ink/60">가족 코드 + PIN으로 들어가요</span>
          </span>
        </Link>

        <Link
          href="/login/parent"
          className="flex items-center gap-3.5 rounded-card border-2 border-ink bg-b-tile p-5 transition-transform active:scale-[0.98]"
        >
          <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl border-2 border-ink bg-white">
            <ParentIcon size={28} />
          </span>
          <span>
            <span className="block text-[19px] font-extrabold">부모예요</span>
            <span className="block text-xs font-medium text-ink/60">이메일로 로그인해요</span>
          </span>
        </Link>
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-soft">
        처음이신가요? <Link href="/signup" className="font-extrabold text-ink underline">부모 회원가입</Link>
      </p>
      <p className="mt-2 text-center text-xs font-semibold text-soft">
        심사위원이신가요? <Link href="/demo" className="underline">데모 체험하기</Link>
      </p>
    </div>
  );
}
