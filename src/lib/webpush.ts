import "server-only";
import webpush from "web-push";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://twin-choice-ten.vercel.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// 구독 하나에 보내고, 만료/무효(404·410)면 지워야 할 id를 돌려준다(호출부에서 정리).
export async function sendPush(sub: PushSubscriptionRow, payload: PushPayload): Promise<{ expired: boolean }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { expired: false };
  } catch (err: any) {
    const status = err?.statusCode;
    return { expired: status === 404 || status === 410 };
  }
}
