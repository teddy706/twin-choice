import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = createClient();
  // middleware.ts가 모든 요청에서 이미 getUser()로 세션을 검증/갱신하므로, 여기서는
  // Auth 서버에 다시 왕복하지 않고 쿠키의 JWT를 로컬에서 읽는 getSession()을 쓴다.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  redirect(session?.user ? "/home" : "/login");
}
