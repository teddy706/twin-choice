// 해커톤 심사용 데모 진입점(/demo) 전용 시드 스크립트.
// 고정된 "체험용 가족" 1개를 만들고(이미 있으면 재사용), 라운드/조율 이력만 항상 초기화한다.
// 실행: npm run seed:demo (내부적으로 `node --env-file=.env.local` 로 .env.local 을 읽는다)
//
// 독립 스크립트라 Next.js 서버 빌드 그래프 밖에서 tsx로 직접 실행된다. 그래서 src/lib/supabase/admin.ts,
// src/lib/childAuth.ts, src/lib/defaultCategories.ts 를 import하지 않고(각각 "server-only"가 있어 이 실행
// 컨텍스트에서 에러가 난다) 그 파일들의 로직만 아래에 그대로 복제했다 — 로직은 원본과 동일하게 유지할 것.

import { randomUUID, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHILD_AUTH_SECRET = process.env.CHILD_AUTH_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CHILD_AUTH_SECRET) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CHILD_AUTH_SECRET 이 필요합니다.\n" +
      "npm run seed:demo 로 실행했는지 확인하세요(.env.local 을 자동으로 읽습니다)."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- src/lib/childAuth.ts 로직 인라인 복제 ---
function childProfileEmail(profileId: string) {
  return `child+${profileId}@child.twin-choice.internal`;
}
function deriveChildAuthPassword(profileId: string, pin: string) {
  return createHmac("sha256", CHILD_AUTH_SECRET!).update(`${profileId}:${pin}`).digest("hex");
}

// --- src/lib/defaultCategories.ts 내용 그대로 복제 ---
const DEFAULT_CATEGORIES = [
  {
    name: "영상",
    emoji: "🎬",
    items: [
      { name: "만화", emoji: "📺" },
      { name: "동물영상", emoji: "🐶" },
      { name: "챌린지", emoji: "🎤" },
      { name: "브이로그", emoji: "📹" },
      { name: "게임영상", emoji: "🎮" },
    ],
  },
  {
    name: "과자",
    emoji: "🍪",
    items: [
      { name: "초코과자", emoji: "🍫" },
      { name: "감자칩", emoji: "🥔" },
      { name: "젤리", emoji: "🍬" },
      { name: "사탕", emoji: "🍭" },
      { name: "과일", emoji: "🍓" },
    ],
  },
  {
    name: "장난감",
    emoji: "🧸",
    items: [
      { name: "레고", emoji: "🧱" },
      { name: "인형", emoji: "🪆" },
      { name: "보드게임", emoji: "🎲" },
      { name: "그림도구", emoji: "🎨" },
      { name: "블록", emoji: "🟦" },
    ],
  },
  {
    name: "놀이",
    emoji: "⚽",
    items: [
      { name: "보드게임", emoji: "🎲" },
      { name: "줄넘기", emoji: "🪢" },
      { name: "그림그리기", emoji: "🖍️" },
      { name: "술래잡기", emoji: "🏃" },
      { name: "만들기", emoji: "✂️" },
    ],
  },
] as const;

const DEMO_JOIN_CODE = "DEMO26";
const DEMO_FAMILY_NAME = "체험용 가족";
export const DEMO_PARENT_EMAIL = "demo-judge@twin-choice.internal";
export const DEMO_PARENT_PASSWORD = "TwinDemo2026!";
const DEMO_CHILD_1 = { name: "체험용 첫째", avatar: "🐰", pin: "1111" };
const DEMO_CHILD_2 = { name: "체험용 둘째", avatar: "🐻", pin: "2222" };

// src/lib/concessionStats.ts 의 weekStartUTC()와 동일한 로직 — 심사 시점이 언제든
// "이번 주/지난 주" 버킷에 정확히 떨어지도록 그 함수를 그대로 재사용해 날짜를 계산한다.
function weekStartUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

// 미래 시각이 되지 않도록(오늘이 월요일이라 "이번 주 +2일"이 아직 안 왔을 수 있음) 지금보다 늦으면 방금 전으로 당긴다.
function clampPast(d: Date): Date {
  const safeNow = new Date(Date.now() - 60_000);
  return d.getTime() > safeNow.getTime() ? safeNow : d;
}

async function ensureDemoFamily() {
  const { data: existingFamily, error: lookupError } = await admin
    .from("families")
    .select("id")
    .eq("join_code", DEMO_JOIN_CODE)
    .maybeSingle();
  if (lookupError) throw new Error(`데모 가족 조회 실패: ${lookupError.message}`);

  if (existingFamily) {
    const familyId = existingFamily.id as string;
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, role")
      .eq("family_id", familyId);
    if (profilesError) throw new Error(`데모 가족 프로필 조회 실패: ${profilesError.message}`);

    const parent = profiles?.find((p) => p.role === "parent");
    const children = profiles?.filter((p) => p.role === "child") ?? [];
    if (!parent || children.length < 2) {
      throw new Error(
        "데모 가족(join_code=DEMO26)은 있는데 부모/자녀 프로필이 예상과 달라요. Supabase 대시보드에서 수동으로 정리한 뒤 다시 실행하세요."
      );
    }
    console.log(`기존 데모 가족 재사용: family_id=${familyId}`);
    return { familyId, parentProfileId: parent.id as string, child1Id: children[0].id as string, child2Id: children[1].id as string };
  }

  console.log("데모 가족이 없어서 새로 만듭니다...");

  const { data: family, error: familyError } = await admin
    .from("families")
    .insert({ name: DEMO_FAMILY_NAME, join_code: DEMO_JOIN_CODE })
    .select("id")
    .single();
  if (familyError || !family) throw new Error(`family 생성 실패: ${familyError?.message}`);
  const familyId = family.id as string;

  const { data: parentUser, error: parentUserError } = await admin.auth.admin.createUser({
    email: DEMO_PARENT_EMAIL,
    password: DEMO_PARENT_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "parent" },
  });
  if (parentUserError || !parentUser.user) throw new Error(`부모 계정 생성 실패: ${parentUserError?.message}`);

  const { data: parentProfile, error: parentProfileError } = await admin
    .from("profiles")
    .insert({ family_id: familyId, user_id: parentUser.user.id, role: "parent", name: "체험용 부모", avatar: "🧑‍🏫" })
    .select("id")
    .single();
  if (parentProfileError || !parentProfile) throw new Error(`부모 프로필 생성 실패: ${parentProfileError?.message}`);

  async function createChild(child: { name: string; avatar: string; pin: string }) {
    const profileId = randomUUID();
    const email = childProfileEmail(profileId);
    const password = deriveChildAuthPassword(profileId, child.pin);

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "child", profile_id: profileId },
    });
    if (userError || !userData.user) throw new Error(`자녀(${child.name}) 계정 생성 실패: ${userError?.message}`);

    const { error: profileError } = await admin.from("profiles").insert({
      id: profileId,
      family_id: familyId,
      user_id: userData.user.id,
      role: "child",
      name: child.name,
      avatar: child.avatar,
      pin_hash: await bcrypt.hash(child.pin, 10),
    });
    if (profileError) throw new Error(`자녀(${child.name}) 프로필 생성 실패: ${profileError.message}`);
    return profileId;
  }

  const child1Id = await createChild(DEMO_CHILD_1);
  const child2Id = await createChild(DEMO_CHILD_2);

  for (const [catIndex, cat] of DEFAULT_CATEGORIES.entries()) {
    const { data: category, error: catError } = await admin
      .from("categories")
      .insert({ family_id: familyId, name: cat.name, emoji: cat.emoji, sort_order: catIndex })
      .select("id")
      .single();
    if (catError || !category) throw new Error(`카테고리(${cat.name}) 생성 실패: ${catError?.message}`);

    const { error: itemsError } = await admin.from("items").insert(
      cat.items.map((item, itemIndex) => ({ category_id: category.id, name: item.name, emoji: item.emoji, sort_order: itemIndex }))
    );
    if (itemsError) throw new Error(`항목(${cat.name}) 생성 실패: ${itemsError.message}`);
  }

  console.log("데모 가족 새로 생성 완료.");
  return { familyId, parentProfileId: parentProfile.id as string, child1Id, child2Id };
}

async function resetRoundHistory(familyId: string, child1Id: string, child2Id: string) {
  console.log("기존 라운드/사진 정리 중...");
  const { error: photosError } = await admin.from("photos").delete().eq("family_id", familyId);
  if (photosError) throw new Error(`사진 정리 실패: ${photosError.message}`);
  // rounds 삭제는 FK cascade로 choices/resolutions 도 함께 지운다(0001_schema.sql 참고).
  const { error: roundsError } = await admin.from("rounds").delete().eq("family_id", familyId);
  if (roundsError) throw new Error(`라운드 정리 실패: ${roundsError.message}`);

  const { data: categories, error: categoriesError } = await admin
    .from("categories")
    .select("id, name, items(id, name)")
    .eq("family_id", familyId)
    .order("sort_order");
  if (categoriesError || !categories?.length) throw new Error(`카테고리 조회 실패: ${categoriesError?.message}`);

  const thisWeekStart = weekStartUTC(new Date());
  const lastWeekStart = addDays(thisWeekStart, -7);

  type HistoryEntry = { type: "roulette" | "turn" | "manual" | "match"; concede: "child1" | "child2" | null; at: Date };
  const history: HistoryEntry[] = [
    { type: "roulette", concede: "child1", at: addDays(lastWeekStart, 1) },
    { type: "turn", concede: "child2", at: addDays(lastWeekStart, 3) },
    { type: "manual", concede: "child1", at: addDays(lastWeekStart, 5) },
    { type: "roulette", concede: "child2", at: clampPast(thisWeekStart) },
    { type: "turn", concede: "child1", at: clampPast(addDays(thisWeekStart, 1)) },
    { type: "match", concede: null, at: clampPast(addDays(thisWeekStart, 2)) },
  ];

  console.log(`과거 조율 이력 ${history.length}건 생성 중...`);
  for (const [idx, entry] of history.entries()) {
    const category = categories[idx % categories.length] as { id: string; name: string; items: { id: string; name: string }[] };
    const items = category.items;
    if (!items || items.length < 2) throw new Error(`카테고리 "${category.name}"에 항목이 2개 미만이에요.`);
    const whenIso = entry.at.toISOString();

    const { data: round, error: roundError } = await admin
      .from("rounds")
      .insert({ family_id: familyId, category_id: category.id, started_by: child1Id, created_at: whenIso })
      .select("id")
      .single();
    if (roundError || !round) throw new Error(`라운드 생성 실패: ${roundError?.message}`);

    const sameChoice = entry.type === "match";
    const child1ItemId = items[0].id;
    const child2ItemId = sameChoice ? items[0].id : items[1].id;

    const { error: choicesError } = await admin.from("choices").insert([
      { round_id: round.id, profile_id: child1Id, item_id: child1ItemId, submitted_at: whenIso },
      { round_id: round.id, profile_id: child2Id, item_id: child2ItemId, submitted_at: whenIso },
    ]);
    if (choicesError) throw new Error(`선택 생성 실패: ${choicesError.message}`);

    const concededProfileId = entry.concede === "child1" ? child1Id : entry.concede === "child2" ? child2Id : null;
    const winnerProfileId = entry.concede === "child1" ? child2Id : entry.concede === "child2" ? child1Id : null;

    const { error: resolutionError } = await admin.from("resolutions").insert({
      round_id: round.id,
      type: entry.type,
      winner_profile_id: winnerProfileId,
      conceded_profile_id: concededProfileId,
      resolved_at: whenIso,
    });
    if (resolutionError) throw new Error(`조율 기록 생성 실패: ${resolutionError.message}`);
  }
}

async function main() {
  const { familyId, child1Id, child2Id } = await ensureDemoFamily();
  await resetRoundHistory(familyId, child1Id, child2Id);

  console.log("\n✅ 데모 가족 준비 완료");
  console.log(`   가족 코드: ${DEMO_JOIN_CODE}`);
  console.log(`   부모: ${DEMO_PARENT_EMAIL} / ${DEMO_PARENT_PASSWORD}`);
  console.log(`   자녀1: ${DEMO_CHILD_1.name} (PIN ${DEMO_CHILD_1.pin})`);
  console.log(`   자녀2: ${DEMO_CHILD_2.name} (PIN ${DEMO_CHILD_2.pin})`);
  console.log("\n언제든 npm run seed:demo 를 다시 실행하면 라운드/조율 이력만 깨끗하게 초기화됩니다.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ 데모 시드 실패:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
