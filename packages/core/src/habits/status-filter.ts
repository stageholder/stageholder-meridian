// Shared habit status-filter logic — used by the PWA habits index and the
// mobile habits screen so "To do" / "Done" mean the same thing on both. Pure,
// no React/platform deps.

import { isEntryComplete } from "./entry-resolution";
import type { Habit } from "../types";

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
 *   • todo — relevant on the day, not done, and not skipped/failed (both are
 *     deliberate outcomes, not outstanding tasks).
 * No filter (`undefined`) matches everything.
 *
 * `weeklyMet` — for `weekly_target` (quota) habits, whether the current week's
 * quota is already satisfied. Quota habits are tracked weekly, not per-day, so
 * once the week's quota is met they are "done" (and never "todo") regardless of
 * whether a session was logged on this specific day. Omit it (undefined) to
 * fall back to per-day evaluation.
 */
export function matchesHabitStatus(
  habit: Habit,
  status: HabitStatusFilter | undefined,
  entry: HabitDayEntry | undefined,
  date: string,
  weeklyMet?: boolean,
): boolean {
  if (!status) return true;

  // Quota habits: weekly progress overrides the per-day view when the caller
  // supplies it. Met → done, not "todo"; not met → still "todo" every day until
  // the week's quota is reached (a single-day skip doesn't close the week).
  if (habit.frequency === "weekly_target" && weeklyMet !== undefined) {
    return status === "done" ? weeklyMet : !weeklyMet;
  }

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
  // skip AND fail are deliberate outcomes that close out the day — neither is
  // an outstanding "to do". Only genuinely un-acted, relevant habits are todo.
  if (done || entry?.type === "skip" || entry?.type === "fail") return false;
  return isHabitRelevantOnDate(habit, date);
}
