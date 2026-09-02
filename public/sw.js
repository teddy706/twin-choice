// 최소 서비스워커: PWA 설치 가능 조건(등록된 SW + fetch 핸들러)만 충족시킨다.
// 오프라인 캐싱 전략은 Phase 1 범위 밖이라 일부러 아무것도 캐싱하지 않고 그대로 통과시킨다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
