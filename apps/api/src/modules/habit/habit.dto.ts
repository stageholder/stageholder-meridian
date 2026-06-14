import { z } from "zod";

export const CreateHabitDto = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  frequency: z
    .enum(["daily", "weekly", "weekly_target", "custom"])
    .optional()
    .default("daily"),
  targetCount: z.number().int().min(1).default(1),
  scheduledDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  weeklyTarget: z.number().int().min(1).max(7).optional(),
  unit: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  groupId: z.string().nullable().optional(),
});
export type CreateHabitDto = z.infer<typeof CreateHabitDto>;

export const UpdateHabitDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  frequency: z.enum(["daily", "weekly", "weekly_target", "custom"]).optional(),
  targetCount: z.number().int().min(1).optional(),
  scheduledDays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .optional()
    .nullable(),
  weeklyTarget: z.number().int().min(1).max(7).optional().nullable(),
  unit: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  groupId: z.string().nullable().optional(),
});
export type UpdateHabitDto = z.infer<typeof UpdateHabitDto>;

export const ReorderHabitsDto = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
      // Optional: when present, also move the habit to this group in the same
      // operation (drag-between-groups). `null` clears the group (→ Ungrouped).
      groupId: z.string().nullable().optional(),
    }),
  ),
});
export type ReorderHabitsDto = z.infer<typeof ReorderHabitsDto>;
