import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// 버그 수정: 화면마다 "지금 로그인한 사람" 기준으로 완전히 개인화된 콘텐츠뿐이라 캐싱될 이유가
// 전혀 없는데, 이 설정이 없으면 Next.js가 서버에서 나가는 fetch(Supabase 호출 포함, 특히
// auth.getUser())를 URL 기준으로 캐싱할 수 있다 — 사용자마다 토큰은 다르지만 요청 URL은 똑같아서,
// 거의 동시에 두 사용자가 요청하면 한쪽 결과가 다른 쪽에 잘못 재사용될 위험이 있다(실제로 두
// 자녀가 시크릿 창 두 개로 거의 동시에 접속했을 때 한쪽 화면이 다른 쪽과 똑같이 보이는 버그로
// 나타났다). 루트 레이아웃에서 한 번에 앱 전체에 적용한다.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "따로 또 같이",
  description: "쌍둥이 자녀의 블라인드 선택과 조율을 기록하는 가족용 앱",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFB84D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jua&family=Gothic+A1:wght@500;700;800;900&display=swap"
        />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
