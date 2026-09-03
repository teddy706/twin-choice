"use client";

import { useEffect, useState } from "react";
import { pushSupported, urlBase64ToUint8Array } from "@/lib/pushClient";

type Status = "checking" | "unsupported" | "off" | "on" | "denied";

// 홈 화면에 두는 알림 켜기/끄기 토글. 자녀·부모 둘 다 쓸 수 있다(상대가 라운드를 시작하거나
// 공개됐을 때 알려주는 용도라 역할 구분이 필요 없음 — 통계성 정보가 아니라 그대로 노출해도 된다).
export function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus("unsupported");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setStatus("on");
    } catch {
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking" || status === "unsupported") return null;

  if (status === "denied") {
    return <p className="mb-3 text-center text-xs text-soft">🔕 알림이 차단되어 있어요. 브라우저 설정에서 허용해주세요.</p>;
  }

  return (
    <button
      className="btn btn-ghost mb-3 border-2 border-[#eee] text-center"
      disabled={busy}
      onClick={status === "on" ? disable : enable}
    >
      {status === "on" ? "🔔 알림 켜짐 (끄기)" : "🔕 알림 받기"}
    </button>
  );
}
