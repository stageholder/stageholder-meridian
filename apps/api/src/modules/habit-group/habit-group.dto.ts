import { z } from "zod";

export const CreateHabitGroupDto = z.object({
  name: z.string().min(1, "Name is required").max(100),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type CreateHabitGroupDto = z.infer<typeof CreateHabitGroupDto>;

export const UpdateHabitGroupDto = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type UpdateHabitGroupDto = z.infer<typeof UpdateHabitGroupDto>;

export const ReorderHabitGroupsDto = z.object({
  items: z.array(z.object({ id: z.string(), order: z.number() })),
});
export type ReorderHabitGroupsDto = z.infer<typeof ReorderHabitGroupsDto>;
