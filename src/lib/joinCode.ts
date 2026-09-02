import "server-only";
import crypto from "crypto";

// 헷갈리는 문자(0/O, 1/I/L) 를 뺀 6자리 가족 코드. 자녀 로그인 화면에서 "어느 가족인지"
// 특정하는 용도로만 쓰이며 그 자체로 인증 수단이 아니다(자녀는 여전히 PIN이 필요).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6) {
  let code = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
