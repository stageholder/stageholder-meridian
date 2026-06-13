// apps/mobile/lib/journal-crypto.ts
//
// Mobile counterpart of the PWA's journal encryption store
// (apps/pwa/src/lib/crypto/encryption-store.ts), trimmed to exactly what the
// mobile journal screens need: CHECK-STATUS + UNLOCK + decrypt + ENCRYPT.
//
// Why a slimmer surface than the PWA store:
//   - Mobile reads, decrypts, and now WRITES (native journal creation), but
//     passphrase setup / change / recovery still live on the web app — they'd
//     need the recovery-code UX the web app already owns. So we carry
//     `encryptJournalPayload` (the write-side counterpart of the decrypt
//     helpers) but not setupPassphrase / changePassphrase / recoverWithCodes.
//   - The DEK is the only sensitive material and it stays IN MEMORY ONLY (a
//     module-level variable, never persisted). Re-launching the app re-locks
//     the journal, which is the desired at-rest behavior on a phone.
//
// The crypto primitives (deriveMasterKey / unwrapDEK / decryptJournal /
// encryptJournal) now run natively via @repo/crypto's react-native-quick-crypto
// path, so unlock + per-entry decrypt + encrypt below are byte-compatible with
// what the web app reads/writes.
//
// State is exposed through a module-level `useSyncExternalStore` singleton —
// the same pattern as lib/platform/theme.ts — so every screen sees one shared
// lock state without a context provider. (zustand would also work; this keeps
// the dependency surface identical to the theme store already in the app.)

import { useSyncExternalStore } from "react";
import {
  deriveMasterKey,
  deriveRecoveryMasterKey,
  generateDEK,
  generateRecoveryCodes,
  generateSalt,
  saltToBase64,
  wrapDEK,
  unwrapDEK,
  saltFromBase64,
  decryptJournal,
  encryptJournal,
  type PortableKey,
} from "@repo/crypto";
import { countWordsFromContent, isJsonContent } from "@repo/core/utils/text";
import type { Journal, JournalContent } from "@repo/core/types";

import { apiClient } from "./api/client";

/* ------------------------------ Store state -------------------------------- */

export interface JournalCryptoSnapshot {
  /** Encryption is configured for this account (server reports a wrapped DEK). */
  isSetup: boolean;
  /** The DEK is in memory — entries can be decrypted. */
  isUnlocked: boolean;
  /** True while the initial /journal-security/keys status fetch is in flight. */
  isLoading: boolean;
}

// In-memory only — NEVER persisted. Cleared on lock() and on every fresh
// launch (module re-init), which re-locks the journal at rest.
let dek: PortableKey | null = null;
// The wrapped DEK + salt come from the server (same source as the PWA store —
// GET /journal-security/keys). We hold them so `unlock()` can derive the
// master key and unwrap without a second round-trip.
let wrappedDek: string | null = null;
let salt: string | null = null;

let snapshot: JournalCryptoSnapshot = {
  isSetup: false,
  isUnlocked: false,
  isLoading: false,
};

const listeners = new Set<() => void>();

function commit(next: Partial<JournalCryptoSnapshot>): void {
  // New object ref only when something actually changed, so
  // useSyncExternalStore can compare by identity.
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): JournalCryptoSnapshot {
  return snapshot;
}

/* ------------------------------- Actions ----------------------------------- */

/**
 * Fetch the encryption status + wrapped key material from the server. Mirrors
 * the PWA store's `checkStatus`: a 200 with `encryptionEnabled:false` means the
 * user never set up journal encryption (so the journal is just plaintext); a
 * failure leaves us in the not-set-up state and the next call corrects it.
 *
 * Safe to call repeatedly — the journal screen calls it on mount + on
 * pull-to-refresh.
 */
export async function checkJournalStatus(): Promise<void> {
  commit({ isLoading: true });
  try {
    const { data } = await apiClient.get<{
      wrappedDek?: string | null;
      salt?: string | null;
      encryptionEnabled?: boolean;
    }>("/journal-security/keys");
    wrappedDek = data.wrappedDek ?? null;
    salt = data.salt ?? null;
    commit({ isSetup: !!data.encryptionEnabled });
  } catch {
    // Offline / 5xx: we can't know the encryption state, so treat it as
    // not-set-up. The next successful checkJournalStatus corrects it. (Same
    // tolerant fallback the PWA store uses now that the offline key cache is
    // gone.)
    commit({ isSetup: false });
  } finally {
    commit({ isLoading: false });
  }
}

/**
 * Derive the master key from the passphrase + stored salt, unwrap the DEK, and
 * hold it in memory. Throws on a wrong passphrase (the AES-KW unwrap fails),
 * which the PassphrasePrompt view catches and surfaces as "Wrong passphrase".
 */
export async function unlockJournal(passphrase: string): Promise<void> {
  if (!wrappedDek || !salt) {
    // Defensive: the screen only renders the prompt once isSetup is true, which
    // only happens after a successful status fetch populated these.
    throw new Error(
      "Encryption keys not loaded. Call checkJournalStatus first.",
    );
  }
  const saltBytes = saltFromBase64(salt);
  const masterKey = await deriveMasterKey(passphrase, saltBytes);
  // unwrapDEK throws if the master key is wrong (bad AES-KW integrity check) —
  // that's our wrong-passphrase signal.
  dek = await unwrapDEK(wrappedDek, masterKey);
  commit({ isUnlocked: true });
}

/**
 * First-time encryption setup — the mobile counterpart of the PWA store's
 * `setupPassphrase` (apps/pwa/src/lib/crypto/encryption-store.ts), byte-for-byte
 * the same flow so a passphrase set on EITHER platform unlocks on the other:
 *   1. derive a master key from `passphrase` + a fresh salt,
 *   2. generate the data-encryption key (DEK) and wrap it with the master key,
 *   3. generate recovery codes, derive a recovery key from them + the user's
 *      `sub`, wrap the DEK with that too,
 *   4. POST both wrapped DEKs + the salt + the codes to /journal-security/setup.
 * On success the DEK is held in memory (journal is immediately unlocked) and
 * the returned recovery codes are shown ONCE by the setup dialog.
 *
 * `userSub` comes from the SDK (`useUser().user.sub`) — the recovery key is
 * derived from it, so it must match what the web app uses.
 */
export async function setupJournalPassphrase(
  passphrase: string,
  userSub: string,
): Promise<string[]> {
  if (!userSub) throw new Error("Not authenticated");

  const saltBytes = generateSalt();
  const masterKey = await deriveMasterKey(passphrase, saltBytes);
  const newDek = await generateDEK();
  const passphraseWrappedDek = await wrapDEK(newDek, masterKey);
  const passphraseSalt = saltToBase64(saltBytes);

  const recoveryCodes = generateRecoveryCodes();
  const recoveryKey = await deriveRecoveryMasterKey(recoveryCodes, userSub);
  const recoveryWrappedDek = await wrapDEK(newDek, recoveryKey);

  await apiClient.post("/journal-security/setup", {
    passphraseWrappedDek,
    passphraseSalt,
    recoveryWrappedDek,
    recoveryCodes,
  });

  // Hold the DEK + key material so the session is immediately unlocked and a
  // later unlock() (after a re-lock) can derive without another round-trip.
  dek = newDek;
  wrappedDek = passphraseWrappedDek;
  salt = passphraseSalt;
  commit({ isSetup: true, isUnlocked: true });

  return recoveryCodes;
}

/**
 * Change the encryption passphrase — byte-for-byte the PWA store's
 * `changePassphrase` (apps/pwa/src/lib/crypto/encryption-store.ts):
 * unwrap the DEK with the OLD passphrase's master key (the AES-KW
 * integrity failure on a wrong passphrase is the error signal), re-wrap
 * under a fresh salt + NEW passphrase, PUT to /journal-security/passphrase.
 * Recovery codes are untouched — only the passphrase wrap changes.
 * On success the journal is unlocked with the held DEK.
 */
export async function changeJournalPassphrase(
  oldPassphrase: string,
  newPassphrase: string,
): Promise<void> {
  if (!wrappedDek || !salt) {
    throw new Error(
      "Encryption keys not loaded. Call checkJournalStatus first.",
    );
  }

  const oldMasterKey = await deriveMasterKey(
    oldPassphrase,
    saltFromBase64(salt),
  );
  const currentDek = await unwrapDEK(wrappedDek, oldMasterKey);

  const newSaltBytes = generateSalt();
  const newMasterKey = await deriveMasterKey(newPassphrase, newSaltBytes);
  const newWrappedDek = await wrapDEK(currentDek, newMasterKey);
  const newSaltStr = saltToBase64(newSaltBytes);

  await apiClient.put("/journal-security/passphrase", {
    passphraseWrappedDek: newWrappedDek,
    passphraseSalt: newSaltStr,
  });

  dek = currentDek;
  wrappedDek = newWrappedDek;
  salt = newSaltStr;
  commit({ isUnlocked: true });
}

/**
 * Recover with the saved recovery codes after a FORGOTTEN passphrase —
 * byte-for-byte the PWA store's `recoverWithCodes`:
 *   1. POST the codes → server validates + returns the recovery-wrapped DEK,
 *   2. derive the recovery key from codes + userSub, unwrap the DEK (throws
 *      on wrong codes),
 *   3. re-wrap under a fresh salt + the NEW passphrase, mint NEW recovery
 *      codes + recovery wrap, finalize server-side (old codes burn),
 *   4. hold the DEK (unlocked) and return the NEW codes for one-time display.
 */
export async function recoverJournalWithCodes(
  codes: string[],
  newPassphrase: string,
  userSub: string,
): Promise<string[]> {
  if (!userSub) throw new Error("Not authenticated");

  const { data } = await apiClient.post<{ recoveryWrappedDek: string }>(
    "/journal-security/recover",
    { codes },
  );

  const recoveryKey = await deriveRecoveryMasterKey(codes, userSub);
  const recoveredDek = await unwrapDEK(data.recoveryWrappedDek, recoveryKey);

  const newSaltBytes = generateSalt();
  const newMasterKey = await deriveMasterKey(newPassphrase, newSaltBytes);
  const newPassphraseWrappedDek = await wrapDEK(recoveredDek, newMasterKey);
  const newSaltStr = saltToBase64(newSaltBytes);

  const newCodes = generateRecoveryCodes();
  const newRecoveryKey = await deriveRecoveryMasterKey(newCodes, userSub);
  const newRecoveryWrappedDek = await wrapDEK(recoveredDek, newRecoveryKey);

  await apiClient.post("/journal-security/recover/finalize", {
    passphraseWrappedDek: newPassphraseWrappedDek,
    passphraseSalt: newSaltStr,
    recoveryWrappedDek: newRecoveryWrappedDek,
    recoveryCodes: newCodes,
  });

  dek = recoveredDek;
  wrappedDek = newPassphraseWrappedDek;
  salt = newSaltStr;
  commit({ isSetup: true, isUnlocked: true });

  return newCodes;
}

/** Drop the DEK from memory — re-locks the journal until the next unlock. */
export function lockJournal(): void {
  dek = null;
  commit({ isUnlocked: false });
}

/** Current in-memory DEK, or null when locked. */
export function getJournalDek(): PortableKey | null {
  return dek;
}

/* ----------------------------- Decryption ---------------------------------- */

/**
 * Decrypt one journal entry's title / content / tags with the in-memory DEK.
 * Returns the entry unchanged when it isn't encrypted (or when the DEK is a
 * mismatch and decrypt throws — the caller decides how to surface that).
 *
 * Mirrors the PWA's `decryptJournalResponse`: the server stores encrypted
 * content as a base64 string, so a NON-string `content` means the row is
 * plaintext mis-flagged as encrypted — recover it instead of throwing on
 * `fromBase64`. After decrypt, content is dual-format (legacy HTML string vs.
 * TipTap JSON) and discriminated by `detectContentFormat`.
 */
export async function decryptJournalEntry(
  journal: Journal,
  key: PortableKey,
): Promise<Journal> {
  if (!journal.encrypted) return journal;
  if (typeof journal.content !== "string") {
    // Non-string content = already-parsed plaintext mis-flagged encrypted.
    return { ...journal, encrypted: false };
  }
  const decrypted = await decryptJournal(
    {
      title: journal.title,
      content: journal.content,
      tags: journal.tags as string,
    },
    key,
  );
  return {
    ...journal,
    title: decrypted.title,
    content: detectContentFormat(decrypted.content),
    tags: decrypted.tags,
  };
}

/**
 * Decrypt a list tolerantly. `Promise.all` would reject the whole batch on the
 * first bad entry — a single corrupt / mis-flagged row would empty the list.
 * `allSettled` keeps the good entries; bad ones are dropped (logged to the
 * console rather than pulling in @repo/core's logger here).
 */
export async function decryptJournalList(
  journals: Journal[],
  key: PortableKey,
): Promise<Journal[]> {
  const results = await Promise.allSettled(
    journals.map((j) => decryptJournalEntry(j, key)),
  );
  const out: Journal[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (r.status === "fulfilled") {
      out.push(r.value);
    } else {
      const id = journals[i]?.id ?? "?";
      console.warn(`[journal-crypto] dropping undecryptable entry ${id}`);
    }
  }
  return out;
}

/**
 * Detect whether a freshly-decrypted (or plaintext) content string is legacy
 * HTML or stringified TipTap JSON. Returns the parsed object for valid TipTap
 * JSON (object with a string `type`), otherwise the input string unchanged.
 * Same discriminator as the PWA's `detectContentFormat`.
 */
export function detectContentFormat(content: string): JournalContent {
  // Fast path: HTML/text never starts with `{`, so skip the parse unless it
  // might be JSON.
  if (content.length === 0 || content[0] !== "{") return content;
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "type" in parsed &&
      typeof (parsed as { type: unknown }).type === "string"
    ) {
      return parsed as JournalContent;
    }
    return content;
  } catch {
    return content;
  }
}

/* ------------------------------ Encryption --------------------------------- */

/** The plaintext a journal write carries before encryption. `content` is
 *  dual-format (TipTap JSON object for new entries, legacy HTML string). */
export interface JournalDraft {
  title: string;
  content: JournalContent;
  tags?: string[];
  mood?: number;
  /** yyyy-mm-dd. */
  date?: string;
}

/** The wire payload after encryption — encrypted strings + plaintext metadata.
 *  Matches what the server stores and what the PWA's encryptJournalPayload
 *  emits (so an entry written on mobile decrypts identically on web). */
export interface EncryptedJournalPayload {
  title: string;
  content: string;
  tags: string;
  mood?: number;
  date?: string;
  encrypted: true;
  wordCount: number;
}

/**
 * Encrypt a journal draft for the POST/PATCH body with the in-memory DEK.
 * Byte-for-byte the same shape as the PWA's `encryptJournalPayload`
 * (apps/pwa/src/lib/crypto/journal-crypto.ts):
 *   - TipTap JSON content is `JSON.stringify`'d to a string FIRST so the
 *     encrypted blob stays a string (decrypt recovers JSON because
 *     JSON.parse on legacy HTML throws — the discriminator in
 *     `detectContentFormat`).
 *   - title / content / tags are AES-GCM encrypted (base64); mood / date stay
 *     plaintext; `encrypted: true` + the server-comparable `wordCount` (from
 *     the shared counter) ride alongside.
 */
export async function encryptJournalPayload(
  draft: JournalDraft,
  key: PortableKey,
): Promise<EncryptedJournalPayload> {
  const wordCount = countWordsFromContent(draft.content);
  // `typeof` (not `isJsonContent`) so TS narrows the false branch to string —
  // the predicate's JSONContentNode doesn't subtract Record<> from the union.
  const contentForEncryption =
    typeof draft.content === "string"
      ? draft.content
      : JSON.stringify(draft.content);
  const encrypted = await encryptJournal(
    {
      title: draft.title,
      content: contentForEncryption,
      tags: draft.tags ?? [],
    },
    key,
  );
  return {
    ...encrypted,
    mood: draft.mood,
    date: draft.date,
    encrypted: true,
    wordCount,
  };
}

/* ----------------------- Plain-text extraction ----------------------------- */

/**
 * Pull plain text out of a journal's dual-format content for previews +
 * excerpts. Dispatches the same way as the features JournalList preview:
 *   - string (legacy HTML) → strip tags
 *   - object (TipTap JSON)  → walk the tree, concatenate text nodes
 *
 * Deliberately tiny + dependency-free: rich editing (TipTap / 10tap) is a
 * web-only concern this pass, so the detail screen renders a plain excerpt
 * instead of pulling the editor stack onto mobile.
 */
export function extractPlainText(content: JournalContent): string {
  if (typeof content === "string") {
    return content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return collectText(content).replace(/\s+/g, " ").trim();
}

function collectText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { text?: unknown; content?: unknown };
  if (typeof n.text === "string") return n.text + " ";
  if (!Array.isArray(n.content)) return "";
  let out = "";
  for (const child of n.content) out += collectText(child);
  return out;
}

/**
 * Word count for an entry, reusing @repo/core's shared counter so the number
 * matches the server-computed `wordCount` (and the PWA). Falls back to the
 * server's `wordCount` when content is the encrypted ciphertext (locked).
 */
export function journalWordCount(journal: Journal): number {
  // When still encrypted, `content` is ciphertext — trust the server count.
  if (journal.encrypted && typeof journal.content === "string") {
    return journal.wordCount ?? 0;
  }
  // isJsonContent guards the dual-format dispatch inside countWordsFromContent.
  if (typeof journal.content === "string" || isJsonContent(journal.content)) {
    return countWordsFromContent(journal.content);
  }
  return journal.wordCount ?? 0;
}

/* ------------------------------- Hook -------------------------------------- */

/** Read the shared journal-crypto lock state in a component. */
export function useJournalCrypto(): JournalCryptoSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
