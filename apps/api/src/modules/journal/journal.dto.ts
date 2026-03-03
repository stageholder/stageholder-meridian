import { z } from 'zod';

export const CreateJournalDto = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().default(''),
  mood: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional().default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});
export type CreateJournalDto = z.infer<typeof CreateJournalDto>;

export const UpdateJournalDto = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string()).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});
export type UpdateJournalDto = z.infer<typeof UpdateJournalDto>;
