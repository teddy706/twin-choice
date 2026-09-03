"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { NavBar } from "@/components/NavBar";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import type { ProfileWithAvatar } from "@/lib/currentProfile";

type ActiveRound = {
  id: string;
  category_id: string;
  started_by: string | null;
  status: string;
  categories: { name: string; emoji: string } | null;
} | null;

export function HomeView({
  profile,
  activeRound,
  myChoiceSubmitted,
  starterName,
}: {
  profile: ProfileWithAvatar;
  activeRound: ActiveRound;
  myChoiceSubmitted: boolean;
  starterName: string | null;
}) {
  const router = useRouter();

  // 3초 폴링: 상대방이 새 라운드를 시작했는지 홈 화면에 조용히 반영한다.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router]);

  const showBanner = activeRound && !myChoiceSubmitted && starterName;

  return (
    <div className="app-shell">
      <Topbar profile={profile} />
      <h1 className="mb-5 mt-1 text-center font-display text-2xl">👯 따로 또 같이</h1>

      <PushNotificationToggle />

      {showBanner && (
        <div className="card border-2 border-a bg-a-light">
          <p className="mb-2.5 font-bold">
            {starterName}가 &ldquo;{activeRound!.categories?.emoji} {activeRound!.categories?.name}&rdquo; 라운드를 시작했어요!
          </p>
          <Link href={`/round/${activeRound!.id}`} className="btn btn-primary mb-0">
            지금 참여하기 →
          </Link>
        </div>
      )}

      {activeRound && myChoiceSubmitted && (
        <div className="card border-2 border-accent bg-accent/10">
          <p className="mb-2.5 font-bold">상대방을 기다리는 중이에요</p>
          <Link href={`/round/${activeRound.id}`} className="btn btn-outline mb-0">
            라운드 보러 가기 →
          </Link>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3.5 text-[19px] font-bold">오늘은 뭘 골라볼까?</h2>
        <Link href="/round/new" className="btn btn-primary mb-0">
          🎯 새로운 선택 시작하기
        </Link>
      </div>

      <div className="card">
        <Link href="/history" className="btn btn-outline mb-0">
          📜 기록 보기
        </Link>
      </div>

      <NavBar role={profile.role} />
    </div>
  );
}
