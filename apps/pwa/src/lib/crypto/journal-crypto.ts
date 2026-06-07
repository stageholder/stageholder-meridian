import { encryptJournal, decryptJournal } from "@repo/crypto";
import { countWordsFromContent, isJsonContent } from "@repo/core/utils/text";
import { logger } from "@repo/core/platform/logger";
import type { Journal, JournalContent } from "@repo/core/types";

/**
 * Encrypts a journal payload for transit / storage. Handles both content
 * formats during the Phase 2 dual-format window:
 *
 *   - HTML string  → encrypt as-is (legacy clients still send this; the
 *                    server stores it back as a string after decrypt).
 *   - TipTap JSON  → `JSON.stringify(json)` before encrypt so the
 *                    encrypted blob stays a string (matches the wire
 *                    contract of `@repo/crypto` which expects strings).
 *
 * The discriminator on decrypt (see `decryptJournalResponse`) round-trips
 * both back to the right shape, so callers don't need to track which
 * format they sent. wordCount is computed via `countWordsFromContent`
 * which dispatches on the same shape — single source of truth.
 */
export async function encryptJournalPayload(
  data: {
    title: string;
    content: JournalContent;
    tags?: string[];
    mood?: number;
    date?: string;
  },
  dek: CryptoKey,
): Promise<{
  title: string;
  content: string;
  tags: string;
  mood?: number;
  date?: string;
  encrypted: true;
  wordCount: number;
}> {
  const wordCount = countWordsFromContent(data.content);
  // Serialize JSON content to string before encryption — `@repo/crypto`
  // operates on strings. We can recover the JSON on decrypt because
  // JSON.parse on an HTML string throws (which we catch as the
  // legacy-HTML signal).
  // `typeof` (not `isJsonContent`) so TS narrows the false branch to string —
  // the predicate's JSONContentNode doesn't subtract Record<> from the union.
  const contentForEncryption =
    typeof data.content === "string"
      ? data.content
      : JSON.stringify(data.content);
  const encrypted = await encryptJournal(
    {
      title: data.title,
      content: contentForEncryption,
      tags: data.tags ?? [],
    },
    dek,
  );
  return {
    ...encrypted,
    mood: data.mood,
    date: data.date,
    encrypted: true,
    wordCount,
  };
}

/**
 * Decrypts a journal response from the server. Discriminates the
 * decrypted content between legacy HTML and new TipTap JSON via a
 * defensive `JSON.parse` attempt — if the result is an object with a
 * `type` field, it's JSON; otherwise it's an HTML string (or a
 * literal-string-that-looks-like-JSON we shouldn't accidentally upgrade).
 *
 * The `type` field check is critical: TipTap docs always have a root
 * `type: "doc"`. A user typing literally `{"foo": "bar"}` as HTML text
 * doesn't have one, so we won't misclassify it.
 */
export async function decryptJournalResponse(
  journal: Journal,
  dek: CryptoKey,
): Promise<Journal> {
  if (!journal.encrypted) return journal;
  // Defensive: if the payload already looks plaintext (content is a
  // parsed TipTap object, not a base64 string), the server stamped
  // `encrypted: true` on a record that was never actually encrypted —
  // passing it through decrypt would throw on `fromBase64`. Recover
  // the entry instead of dropping it.
  if (looksPlaintext(journal)) {
    return { ...journal, encrypted: false };
  }
  const decrypted = await decryptJournal(
    {
      title: journal.title,
      // The encrypted content was always stored as a string (the
      // ciphertext). We pass it through to the decrypt primitive as-is;
      // dual-format discrimination happens AFTER decrypt.
      content: journal.content as string,
      tags: journal.tags as string,
    },
    dek,
  );
  return {
    ...journal,
    title: decrypted.title,
    content: detectContentFormat(decrypted.content),
    tags: decrypted.tags,
  };
}

/**
 * Decrypt a list of journals tolerantly. `Promise.all` would reject the
 * whole batch on the first bad entry — a single corrupted / mis-flagged
 * row would empty the journal list UI. Use `allSettled` so successful
 * entries always survive; the bad ones are logged and dropped.
 */
export async function decryptJournalList(
  journals: Journal[],
  dek: CryptoKey,
): Promise<Journal[]> {
  const results = await Promise.allSettled(
    journals.map((j) => decryptJournalResponse(j, dek)),
  );
  const out: Journal[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (r.status === "fulfilled") {
      out.push(r.value);
      continue;
    }
    const message =
      r.reason instanceof Error ? r.reason.message : String(r.reason);
    logger.warn(
      `[journal-crypto] dropping undecryptable entry ${journals[i]?.id ?? "?"}: ${message}`,
    );
  }
  return out;
}

function looksPlaintext(journal: Journal): boolean {
  // Real encrypted content is a base64 string. A non-string content
  // (e.g. already-parsed TipTap JSON object) is the only reliable
  // signal that the entry is plaintext mis-flagged as encrypted.
  // (Tags can't be checked: the server returns encrypted `tags` as an
  // array containing the ciphertext string, not as the ciphertext
  // string itself, so `Array.isArray` would false-positive every
  // genuinely-encrypted entry.)
  return typeof journal.content !== "string";
}

/**
 * Detect whether a freshly-decrypted (or unencrypted) content string is
 * legacy HTML or stringified TipTap JSON. Returns the right shape for
 * the consumer to dispatch on:
 *
 *   - Returns a parsed object when the string is valid TipTap JSON
 *     (object with `type` field, typically `"doc"`).
 *   - Returns the input string unchanged otherwise (legacy HTML or
 *     coincidental text that happens to parse as something non-doc).
 *
 * Exported for use in offline cache layers and other boundaries where
 * dual-format detection is needed outside the encryption flow.
 */
export function detectContentFormat(content: string): JournalContent {
  // Cheap fast-path: HTML almost always starts with `<` or text; JSON
  // starts with `{`. Skip the parse attempt unless it might be JSON.
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
    // Parsed as JSON but doesn't have a TipTap-doc shape — treat as
    // legacy HTML to be safe. (A user typing literal JSON in their
    // journal shouldn't get auto-upgraded.)
    return content;
  } catch {
    return content;
  }
}
