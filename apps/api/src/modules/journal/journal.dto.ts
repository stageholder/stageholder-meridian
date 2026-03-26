import { z } from "zod";

export const CreateJournalDto = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().default(""),
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
  content: z.string().optional(),
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
