import { z } from "zod";

// Backfill window: users may log a missed day up to ~1 year back, but not the
// future. A 1-day future tolerance absorbs the client being in a timezone
// ahead of the server. Comparison is in UTC-ms — coarse but sufficient as a
// guardrail against absurd dates and future-dated farming.
const ONE_DAY_MS = 86_400_000;
const MAX_BACKFILL_DAYS = 366;
const entryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((d) => {
    const day = new Date(d + "T00:00:00Z").getTime();
    if (Number.isNaN(day)) return false;
    const now = Date.now();
    return (
      day <= now + ONE_DAY_MS && day >= now - MAX_BACKFILL_DAYS * ONE_DAY_MS
    );
  }, "Date must be within the last year and not in the future");

export const CreateHabitEntryDto = z.object({
  date: entryDate,
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
