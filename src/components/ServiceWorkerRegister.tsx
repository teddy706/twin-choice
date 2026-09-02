"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 설치 실패해도 앱 사용 자체는 문제없으므로 조용히 무시한다.
      });
    }
  }, []);
  return null;
}
