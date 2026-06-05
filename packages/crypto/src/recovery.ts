import { toBase64 } from "./keys";
import { getRandomBytes, sha256 } from "./primitives";

const CODE_LENGTH = 8;
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 to avoid confusion

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = getRandomBytes(CODE_LENGTH);
    let code = "";
    for (let j = 0; j < CODE_LENGTH; j++) {
      code += CHARSET[bytes[j]! % CHARSET.length];
    }
    codes.push(code);
  }
  return codes;
}

export async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const sorted = [...codes].sort().join(",");
  const hash = await sha256(encoder.encode(sorted));
  return toBase64(hash);
}
