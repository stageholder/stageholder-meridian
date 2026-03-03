import { z } from 'zod';

export const CreateHabitDto = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']).optional().default('daily'),
  targetCount: z.number().int().min(1).default(1),
  unit: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type CreateHabitDto = z.infer<typeof CreateHabitDto>;

export const UpdateHabitDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
  targetCount: z.number().int().min(1).optional(),
  unit: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type UpdateHabitDto = z.infer<typeof UpdateHabitDto>;
