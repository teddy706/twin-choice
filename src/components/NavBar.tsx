"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

// 자녀 role 에는 통계/양보지수로 이어질 수 있는 항목을 아예 배열에 넣지 않는다.
// Phase 1에는 그런 화면이 없지만, 이 배열 방식 자체가 Phase 2에서 부모 전용 항목을 추가할 때
// "역할별로 다른 항목 리스트"라는 패턴을 그대로 이어받게 하기 위한 것이다.
function navItemsFor(role: Role) {
  const base = [
    { href: "/home", icon: "🏠", label: "홈" },
    { href: "/history", icon: "📜", label: "기록" },
  ];
  if (role === "parent") {
    base.push({ href: "/settings/categories", icon: "🗂️", label: "카테고리" });
    base.push({ href: "/settings/children", icon: "⚙️", label: "자녀 관리" });
  }
  return base;
}

export function NavBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsFor(role);

  return (
    <div className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-[480px] bg-white shadow-[0_-4px_14px_rgba(0,0,0,0.06)]">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 px-1 py-2.5 text-center text-[11px] font-semibold ${
              active ? "text-accent" : "text-soft"
            }`}
          >
            <span className="mb-0.5 block text-xl">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
