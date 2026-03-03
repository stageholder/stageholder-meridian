import { z } from 'zod';

export const CreateHabitEntryDto = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  value: z.number().min(0),
  notes: z.string().max(1000).optional(),
});
export type CreateHabitEntryDto = z.infer<typeof CreateHabitEntryDto>;

export const UpdateHabitEntryDto = z.object({
  value: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});
export type UpdateHabitEntryDto = z.infer<typeof UpdateHabitEntryDto>;
