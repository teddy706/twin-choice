import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  childProfileEmail,
  deriveChildAuthPassword,
  isPinLocked,
  isValidPin,
  PIN_LOCK_DURATION_MS,
  PIN_MAX_ATTEMPTS,
} from "@/lib/childAuth";

export async function POST(request: Request) {
  const { familyId, profileId, pin } = await request.json();

  if (!familyId || !profileId || !isValidPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "PIN 4자리를 입력해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  // profileId 가 실제로 그 family 의 child 프로필인지 서버에서 재확인한다(클라이언트 값 신뢰 금지).
  const { data: profile } = await admin
    .from("profiles")
    .select("id, family_id, role, pin_fail_count, pin_locked_until")
    .eq("id", profileId)
    .eq("family_id", familyId)
    .eq("role", "child")
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "프로필을 찾을 수 없어요." }, { status: 404 });
  }

  if (isPinLocked(profile.pin_locked_until)) {
    return NextResponse.json(
      { error: "너무 많이 틀렸어요. 잠시 후 다시 시도해주세요." },
      { status: 429 },
    );
  }

  const email = childProfileEmail(profile.id);
  const password = deriveChildAuthPassword(profile.id, String(pin));

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const nextFailCount = profile.pin_fail_count + 1;
    const lockedOut = nextFailCount >= PIN_MAX_ATTEMPTS;
    await admin
      .from("profiles")
      .update({
        pin_fail_count: lockedOut ? 0 : nextFailCount,
        pin_locked_until: lockedOut ? new Date(Date.now() + PIN_LOCK_DURATION_MS).toISOString() : null,
      })
      .eq("id", profile.id);

    return NextResponse.json(
      {
        error: lockedOut
          ? "너무 많이 틀렸어요. 잠시 후 다시 시도해주세요."
          : "PIN이 맞지 않아요.",
      },
      { status: lockedOut ? 429 : 401 },
    );
  }

  if (profile.pin_fail_count > 0 || profile.pin_locked_until) {
    await admin.from("profiles").update({ pin_fail_count: 0, pin_locked_until: null }).eq("id", profile.id);
  }

  return NextResponse.json({ ok: true });
}
