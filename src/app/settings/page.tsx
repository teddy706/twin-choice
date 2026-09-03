import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/currentProfile";
import { Topbar } from "@/components/Topbar";

const LINKS = [
  { href: "/settings/children", icon: "🧒", title: "자녀 관리", desc: "가족 코드, 자녀 프로필·PIN, 데이터 삭제" },
  { href: "/settings/categories", icon: "🗂️", title: "카테고리 관리", desc: "카테고리·항목 추가 및 숨기기" },
  { href: "/settings/photos", icon: "🖼️", title: "사진 아카이브", desc: "자녀가 찍은 사진 모아보기, 라벨 수정" },
  { href: "/settings/dashboard", icon: "📊", title: "대시보드", desc: "양보 지수, 주간 추이" },
];

export default async function SettingsHubPage() {
  const profile = await requireProfile();
  if (profile.role !== "parent") redirect("/home");

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <h2 className="mb-3.5 text-[19px] font-bold">⚙️ 설정</h2>
      <div className="card">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 border-b border-[#f4f4f4] py-3.5 last:border-none"
          >
            <span className="text-2xl">{link.icon}</span>
            <span>
              <div className="font-bold">{link.title}</div>
              <div className="text-xs text-soft">{link.desc}</div>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
