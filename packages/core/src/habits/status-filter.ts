// Shared habit status-filter logic — used by the PWA habits index and the
// mobile habits screen so "To do" / "Done" mean the same thing on both. Pure,
// no React/platform deps.

import { isEntryComplete } from "./entry-resolution.js";
import type { Habit } from "../types/index.js";

/** The status filter applied to the habit list (relative to a date). */
export type HabitStatusFilter = "todo" | "done";

/** A day's completion entry as it arrives from the calendar endpoint. */
export type HabitDayEntry = {
  value: number;
  type?: string;
  targetCountSnapshot?: number;
};

/**
 * Is this habit relevant (scheduled) on `date`? Daily + scheduled-day habits
 * follow their schedule; `weekly_target` (quota) habits can be done any day, so
 * they're always relevant. Habits created after `date` are not.
 */
export function isHabitRelevantOnDate(
  habit: Pick<Habit, "createdAt" | "frequency" | "scheduledDays">,
  date: string,
): boolean {
  const created = habit.createdAt?.slice(0, 10);
  if (created && created > date) return false;
  if (habit.frequency === "weekly_target") return true;
  if (!habit.scheduledDays?.length) return true;
  const dow = new Date(date + "T00:00:00").getDay();
  return habit.scheduledDays.includes(dow);
}

/**
 * Status-filter predicate for `date`:
 *   • done — the day's entry meets the target.
 *   • todo — relevant on the day, not done, and not skipped (skip is a
 *     deliberate opt-out, not an outstanding task).
 * No filter (`undefined`) matches everything.
 */
export function matchesHabitStatus(
  habit: Habit,
  status: HabitStatusFilter | undefined,
  entry: HabitDayEntry | undefined,
  date: string,
): boolean {
  if (!status) return true;
  const done = entry
    ? isEntryComplete(
        {
          value: entry.value,
          type: entry.type as "completion" | "skip" | "fail" | undefined,
          targetCountSnapshot: entry.targetCountSnapshot,
        },
        habit,
      )
    : false;
  if (status === "done") return done;
  if (done || entry?.type === "skip") return false;
  return isHabitRelevantOnDate(habit, date);
}
