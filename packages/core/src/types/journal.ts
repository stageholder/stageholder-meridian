/**
 * Journal content storage type. Dual-format during the Phase 2 HTML → JSON
 * migration window:
 *
 *   - `string`  = legacy HTML (pre-migration entries still in the DB)
 *   - `object`  = TipTap JSON (post-migration; canonical going forward)
 *
 * Consumers must dispatch on type before rendering. Use
 * `isJsonContent(c)` from `@repo/core/utils/text` if you need a runtime
 * guard, or just `typeof content === "string"` inline.
 *
 * For encrypted journals the raw content is always a string (the
 * encrypted ciphertext). After client-side decrypt, the decrypted
 * payload follows the same dual-format rule — discriminate then.
 */
export type JournalContent = string | Record<string, unknown>;

export interface Journal {
  id: string;
  userSub: string;
  title: string;
  content: JournalContent;
  mood?: number;
  tags: string[] | string;
  authorId: string;
  date: string;
  wordCount: number;
  encrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalStatDay {
  date: string;
  count: number;
  words: number;
}

export interface JournalStats {
  baseline: {
    totalCount: number;
    totalWords: number;
  };
  days: JournalStatDay[];
}
