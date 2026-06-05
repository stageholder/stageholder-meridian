// apps/mobile/lib/journal-crypto.ts
//
// Mobile counterpart of the PWA's journal encryption store
// (apps/pwa/src/lib/crypto/encryption-store.ts), trimmed to exactly what the
// mobile journal screens need in this pass: CHECK-STATUS + UNLOCK + decrypt.
//
// Why a slimmer surface than the PWA store:
//   - Mobile is read-first this pass. Creation / passphrase setup / change /
//     recovery still live on the web app (the journal screen says as much), so
//     we don't carry setupPassphrase / changePassphrase / recoverWithCodes
//     here yet — they'd need the recovery-code UX the web app already owns.
//   - The DEK is the only sensitive material and it stays IN MEMORY ONLY (a
//     module-level variable, never persisted). Re-launching the app re-locks
//     the journal, which is the desired at-rest behavior on a phone.
//
// The crypto primitives (deriveMasterKey / unwrapDEK / decryptJournal) now run
// natively via @repo/crypto's react-native-quick-crypto path, so the unlock +
// per-entry decrypt below are byte-compatible with what the web app wrote.
//
// State is exposed through a module-level `useSyncExternalStore` singleton —
// the same pattern as lib/platform/theme.ts — so every screen sees one shared
// lock state without a context provider. (zustand would also work; this keeps
// the dependency surface identical to the theme store already in the app.)

import { useSyncExternalStore } from "react";
import {
  deriveMasterKey,
  unwrapDEK,
  saltFromBase64,
  decryptJournal,
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
