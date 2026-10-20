// Dev-only tripwire: shout when an entry that still looks ENCRYPTED reaches a
// rendering surface. Every journal read is supposed to decrypt inside its
// queryFn (lib/api/journals.ts) and the EncryptionGate is supposed to keep
// the journal unmounted while locked, so a base64 blob on screen means one of
// those invariants broke. The user reported exactly that on web/desktop
// ("a base64 blob, then the real text" when opening an entry after unlock,
// 2026-10-20) and it could not be reproduced on the E2E account — this log
// captures WHICH surface painted it and what the lock state was at that
// moment, so the next sighting pins the path. No-op in production builds.
import type { Journal } from "@repo/core/types";
import { useEncryptionStore } from "./encryption-store";

// A real AES-GCM blob is base64 of iv+ciphertext+tag: never shorter than ~40
// chars and never contains spaces. Plain titles practically never match.
const BLOB = /^[A-Za-z0-9+/]{40,}={0,2}$/;

const seen = new Set<string>();

export function warnIfCiphertext(where: string, journal: Journal): void {
  if (!import.meta.env.DEV) return;
  const title = typeof journal.title === "string" ? journal.title : "";
  const content = typeof journal.content === "string" ? journal.content : "";
  if (!BLOB.test(title) && !BLOB.test(content)) return;
  const key = `${where}:${journal.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  const s = useEncryptionStore.getState();
  console.warn("[journal-crypto] CIPHERTEXT reached the UI", {
    where,
    id: journal.id,
    encryptedFlag: journal.encrypted,
    titleIsBlob: BLOB.test(title),
    contentIsBlob: BLOB.test(content),
    isSetup: s.isSetup,
    isUnlocked: s.isUnlocked,
    hasDek: s.dek !== null,
    dekEpoch: s.dekEpoch,
    updatedAt: journal.updatedAt,
  });
}
