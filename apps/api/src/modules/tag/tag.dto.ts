import { z } from 'zod';

export const CreateTagDto = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().max(20).optional().default('#6B7280'),
});
export type CreateTagDto = z.infer<typeof CreateTagDto>;

export const UpdateTagDto = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(20).optional(),
});
export type UpdateTagDto = z.infer<typeof UpdateTagDto>;
