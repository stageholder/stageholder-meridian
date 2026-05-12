import { z } from "zod";

export const CreateHabitEntryDto = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  value: z.number().min(0),
  type: z.enum(["completion", "skip", "fail"]).optional().default("completion"),
  skipReason: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});
export type CreateHabitEntryDto = z.infer<typeof CreateHabitEntryDto>;

// PATCH accepts type + skipReason so clients can convert an existing entry
// between completion / skip without hitting the per-(habit, date) uniqueness
// constraint via DELETE+POST. Switching to skip forces value to 0; switching
// back to completion clears skipReason — both invariants live in the entity.
export const UpdateHabitEntryDto = z.object({
  value: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  type: z.enum(["completion", "skip", "fail"]).optional(),
  skipReason: z.string().max(200).optional(),
});
export type UpdateHabitEntryDto = z.infer<typeof UpdateHabitEntryDto>;
