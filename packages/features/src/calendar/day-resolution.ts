// src/calendar/day-resolution.ts
//
// Pure helpers for splitting a day-agenda's items into active vs. done, shared
// by the PWA and native calendar agendas so the split rule can't drift.

import { resolveTargetCount } from "@repo/core/habits/entry-resolution";
import type { Habit } from "@repo/core/types";

/** The slim habit-entry shape both platforms' calendar day payloads carry. */
export interface DayHabitEntry {
  habitId: string;
  value: number;
  type?: string;
  targetCountSnapshot?: number;
}

/**
 * A habit is "resolved" for the day when its calendar entry is complete,
 * skipped, or failed — read from the day's entries (no per-habit refetch).
 */
export function isHabitResolvedForDay(
  habit: Habit,
  dayEntries: DayHabitEntry[],
): boolean {
  const entry = dayEntries.find((e) => e.habitId === habit.id);
  if (!entry) return false;
  if (entry.type === "skip" || entry.type === "fail") return true;
  const target =
    resolveTargetCount(
      { targetCountSnapshot: entry.targetCountSnapshot },
      habit,
    ) || 1;
  return entry.value >= target;
}

/** Split scheduled habits into pending (act on) vs. done (collapsed). */
export function splitHabitsByDay(
  scheduled: Habit[],
  dayEntries: DayHabitEntry[],
): { pending: Habit[]; done: Habit[] } {
  const pending: Habit[] = [];
  const done: Habit[] = [];
  for (const h of scheduled) {
    (isHabitResolvedForDay(h, dayEntries) ? done : pending).push(h);
  }
  return { pending, done };
}
