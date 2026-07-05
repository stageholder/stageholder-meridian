import { z } from "zod";

/**
 * Journal content during the Phase 2 dual-format window:
 *   - string  = legacy HTML (clients sending pre-migration format)
 *   - object  = TipTap JSON (clients on the new format)
 *
 * `passthrough()` because TipTap JSON has open-ended shape (custom node
 * attrs, marks, etc.) we don't want to strip. The server treats content
 * as opaque storage during this window — type validation is only that
 * it's a string or an object, not its inner schema.
 */
// Size caps guard against multi-MB blobs (up to Mongo's 16MB doc cap) causing
// memory pressure on the user's own list/sync loads. Content is bounded by its
// serialized length whether it's an HTML string or TipTap JSON; ciphertext runs
// ~1.33× the plaintext, so ~2M chars comfortably fits a very long entry.
const MAX_CONTENT_CHARS = 2_000_000;
const MAX_TITLE_CHARS = 2_000; // short even when encrypted (base64 of a title)
const MAX_TAGS = 50;
const MAX_TAG_CHARS = 100;
const MAX_ENCRYPTED_TAGS_CHARS = 20_000; // ciphertext of the tags JSON

const JournalContentSchema = z
  .union([z.string(), z.object({}).passthrough()])
  .refine((c) => {
    const serialized = typeof c === "string" ? c : JSON.stringify(c);
    return serialized.length <= MAX_CONTENT_CHARS;
  }, `Content exceeds ${MAX_CONTENT_CHARS} characters`);

// Array branch = plaintext tags; string branch = the single ciphertext blob of
// the encrypted tags JSON.
const TagsSchema = z.union([
  z.array(z.string().max(MAX_TAG_CHARS)).max(MAX_TAGS),
  z.string().max(MAX_ENCRYPTED_TAGS_CHARS),
]);

export const CreateJournalDto = z.object({
  title: z.string().min(1, "Title is required").max(MAX_TITLE_CHARS),
  content: JournalContentSchema.default(""),
  mood: z.number().int().min(1).max(5).optional(),
  tags: TagsSchema.optional().default([]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  wordCount: z.number().int().min(0).max(10_000_000).optional(),
  encrypted: z.boolean().optional(),
});
export type CreateJournalDto = z.infer<typeof CreateJournalDto>;

export const UpdateJournalDto = z.object({
  title: z.string().min(1).max(MAX_TITLE_CHARS).optional(),
  content: JournalContentSchema.optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  tags: TagsSchema.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  wordCount: z.number().int().min(0).max(10_000_000).optional(),
  encrypted: z.boolean().optional(),
});
export type UpdateJournalDto = z.infer<typeof UpdateJournalDto>;
