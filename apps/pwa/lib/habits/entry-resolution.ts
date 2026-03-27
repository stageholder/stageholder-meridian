import type { Habit, HabitEntry } from "@repo/core/types";

/**
 * Returns the targetCount that was in effect when this entry was recorded.
 * Falls back to the current habit targetCount for entries created before
 * the snapshot feature was introduced.
 */
export function resolveTargetCount(
  entry: Pick<HabitEntry, "targetCountSnapshot">,
  habit: Pick<Habit, "targetCount">,
): number {
  return entry.targetCountSnapshot ?? habit.targetCount;
}

/**
 * Returns true if the entry represents a completed habit for that day,
 * using the snapshotted target where available.
 */
export function isEntryComplete(
  entry: Pick<HabitEntry, "value" | "type" | "targetCountSnapshot">,
  habit: Pick<Habit, "targetCount">,
): boolean {
  if (entry.type === "skip") return false;
  return entry.value >= resolveTargetCount(entry, habit);
}

/**
 * Returns the ratio (0..1+) of completion using the snapshotted target.
 */
export function entryCompletionRatio(
  entry: Pick<HabitEntry, "value" | "targetCountSnapshot">,
  habit: Pick<Habit, "targetCount">,
): number {
  const target = resolveTargetCount(entry, habit);
  return target > 0 ? entry.value / target : 0;
}

/**
 * Counts how many habits from the provided list were both:
 * 1. Created on or before the given date (so new habits don't inflate past rings)
 * 2. Scheduled on that day of week
 */
export function countScheduledHabitsForDate(
  habits: Habit[] | undefined,
  date: string,
): number {
  if (!habits) return 0;
  const dow = new Date(date + "T00:00:00").getDay();
  return habits.filter((h) => {
    const createdDate = h.createdAt?.slice(0, 10);
    if (createdDate && createdDate > date) return false;
    if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
    return h.scheduledDays.includes(dow);
  }).length;
}
