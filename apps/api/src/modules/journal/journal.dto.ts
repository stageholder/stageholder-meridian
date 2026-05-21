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
const JournalContentSchema = z.union([z.string(), z.object({}).passthrough()]);

export const CreateJournalDto = z.object({
  title: z.string().min(1, "Title is required"),
  content: JournalContentSchema.default(""),
  mood: z.number().int().min(1).max(5).optional(),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  wordCount: z.number().int().min(0).optional(),
  encrypted: z.boolean().optional(),
});
export type CreateJournalDto = z.infer<typeof CreateJournalDto>;

export const UpdateJournalDto = z.object({
  title: z.string().min(1).optional(),
  content: JournalContentSchema.optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  wordCount: z.number().int().min(0).optional(),
  encrypted: z.boolean().optional(),
});
export type UpdateJournalDto = z.infer<typeof UpdateJournalDto>;
