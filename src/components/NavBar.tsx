"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, ListIcon, GearIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

// 자녀 role 에는 통계/양보지수로 이어질 수 있는 항목을 아예 배열에 넣지 않는다.
// Phase 1에는 그런 화면이 없지만, 이 배열 방식 자체가 Phase 2에서 부모 전용 항목을 추가할 때
// "역할별로 다른 항목 리스트"라는 패턴을 그대로 이어받게 하기 위한 것이다.
function navItemsFor(role: Role) {
  const base = [
    { href: "/home", Icon: HomeIcon, label: "홈" },
    { href: "/history", Icon: ListIcon, label: "기록" },
  ];
  if (role === "parent") {
    // 자녀 관리·카테고리·사진 아카이브처럼 부모 전용 화면이 계속 늘어날 예정이라
    // 각각을 하단 탭에 나열하지 않고 "설정" 허브 하나로 모은다.
    base.push({ href: "/settings", Icon: GearIcon, label: "설정" });
  }
  return base;
}

export function NavBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsFor(role);

  return (
    <div className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-[480px] border-t-2 border-ink bg-white">
      {items.map(({ href, Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 px-1 py-2.5 text-center text-[11px] font-bold ${
              active ? "text-ink" : "text-ink/40"
            }`}
          >
            <Icon size={22} className="mx-auto mb-0.5 block" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
