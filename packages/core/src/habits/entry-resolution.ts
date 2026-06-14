import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import type { Habit, HabitEntry } from "../types";

/**
 * Pure, cross-platform habit entry math. Originally lived in
 * `apps/pwa/src/lib/habits/entry-resolution.ts`; lifted here so the
 * future React Native mobile app can reuse the same resolution rules
 * without duplicating them. No React, no web APIs — just `date-fns`
 * + the entity types.
 *
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
  if (entry.type === "skip" || entry.type === "fail") return false;
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
 *
 * `weekly_target` (quota) habits are NOT day-scheduled — they're tracked weekly
 * — so they're excluded from the per-day denominator entirely.
 */
export function countScheduledHabitsForDate(
  habits: Habit[] | undefined,
  date: string,
): number {
  if (!habits) return 0;
  const dow = new Date(date + "T00:00:00").getDay();
  return habits.filter((h) => {
    if (h.archivedAt) return false;
    if (h.frequency === "weekly_target") return false;
    const createdDate = h.createdAt?.slice(0, 10);
    if (createdDate && createdDate > date) return false;
    if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
    return h.scheduledDays.includes(dow);
  }).length;
}

/** Shape of the per-day entry aggregate used by the weekly-quota helpers. */
type EntryMapValue = {
  value: number;
  type?: string;
  targetCountSnapshot?: number;
};

/**
 * Counts the number of COMPLETED days within the week beginning at
 * `weekStart` (inclusive) through +6 days. A day counts when it has an entry
 * that is neither a skip nor a fail and whose value reaches the snapshotted
 * target. Used for `weekly_target` (quota) habits where progress is weekly.
 */
export function weeklyCompletions(
  entryMap: Map<string, EntryMapValue>,
  weekStart: Date,
  habit: Pick<Habit, "targetCount">,
): number {
  let count = 0;
  for (let i = 0; i <= 6; i++) {
    const d = addDays(weekStart, i);
    const entry = entryMap.get(format(d, "yyyy-MM-dd"));
    if (!entry) continue;
    if (entry.type === "skip" || entry.type === "fail") continue;
    if (
      entry.value >=
      resolveTargetCount(
        { targetCountSnapshot: entry.targetCountSnapshot },
        habit,
      )
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Weekly streak for a `weekly_target` (quota) habit: the number of consecutive
 * weeks (current + preceding) in which the habit hit its weekly quota. The
 * current week counts the moment the quota is met; preceding weeks must each
 * meet the quota or the streak breaks.
 */
export function calculateWeeklyStreak(
  entryMap: Map<string, EntryMapValue>,
  habit: Pick<Habit, "targetCount" | "weeklyTarget">,
): number {
  const quota = habit.weeklyTarget ?? 1;
  const now = new Date();
  // Monday-start weeks, matching the card week-strip + the calendar's layout.
  let streak =
    weeklyCompletions(entryMap, startOfWeek(now, { weekStartsOn: 1 }), habit) >=
    quota
      ? 1
      : 0;
  for (let w = 1; w <= 52; w++) {
    const c = weeklyCompletions(
      entryMap,
      startOfWeek(subWeeks(now, w), { weekStartsOn: 1 }),
      habit,
    );
    if (c >= quota) streak++;
    else break;
  }
  return streak;
}
