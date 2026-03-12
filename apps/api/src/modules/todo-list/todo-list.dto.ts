import { z } from "zod";

export const CreateTodoListDto = z.object({
  name: z.string().min(1, "Name is required").max(100),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  isShared: z.boolean().optional().default(false),
});
export type CreateTodoListDto = z.infer<typeof CreateTodoListDto>;

export const UpdateTodoListDto = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  isShared: z.boolean().optional(),
});
export type UpdateTodoListDto = z.infer<typeof UpdateTodoListDto>;
