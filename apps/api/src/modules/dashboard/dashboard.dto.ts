import { z } from "zod";

export const DashboardTodayQuery = z.object({
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "today must be yyyy-mm-dd")
    .optional(),
});
export type DashboardTodayQuery = z.infer<typeof DashboardTodayQuery>;
