import { z } from 'zod';

export const GetLightEventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GetLightEventsQuery = z.infer<typeof GetLightEventsQuery>;

export const UpdateTargetsDto = z.object({
  todoTargetDaily: z.number().int().min(1).max(50).optional(),
  journalTargetDailyWords: z.number().int().min(10).max(5000).optional(),
});
export type UpdateTargetsDto = z.infer<typeof UpdateTargetsDto>;
