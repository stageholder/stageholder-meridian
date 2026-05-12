// apps/mobile/lib/habits.ts
//
// Pure helpers for habit value/target math. Ported from the PWA's
// lib/habits/entry-resolution.ts so streaks + completion math are
// byte-identical across surfaces (mobile/PWA must agree on what "done
// today" means or the activity rings will disagree).
//
// `targetCountSnapshot` is a per-entry snapshot of the habit's target at
// the moment the entry was recorded. Older entries (pre-snapshot) fall
// back to the habit's current target. This lets users change a habit's
// target without retroactively breaking past completions.

import type { Habit, HabitEntry } from "@repo/core/types";

/** Target in effect when this entry was recorded; falls back to the live habit. */
export function resolveTargetCount(
  entry: Pick<HabitEntry, "targetCountSnapshot">,
  habit: Pick<Habit, "targetCount">,
): number {
  return entry.targetCountSnapshot ?? habit.targetCount ?? 1;
}

/** True if this single entry already cleared the snapshotted target. */
export function isEntryComplete(
  entry: Pick<HabitEntry, "value" | "type" | "targetCountSnapshot">,
  habit: Pick<Habit, "targetCount">,
): boolean {
  if (entry.type === "skip") return false;
  return entry.value >= resolveTargetCount(entry, habit);
}

/** 0..1+ ratio against the snapshotted target. >1 = overachieved. */
export function entryCompletionRatio(
  entry: Pick<HabitEntry, "value" | "targetCountSnapshot">,
  habit: Pick<Habit, "targetCount">,
): number {
  const target = resolveTargetCount(entry, habit);
  return target > 0 ? entry.value / target : 0;
}

/**
 * Per-habit today summary derived from the day's entries. Multiple entries
 * for the same date sum their `value` — matches the PWA's HabitSummary
 * aggregation in components/dashboard/habit-summary.tsx:37-46.
 *
 * Returns null if the habit has no entry for the given date (i.e. the user
 * hasn't checked in yet).
 */
export type DayProgress = {
  value: number;
  type: "completion" | "skip";
  targetCountSnapshot?: number;
};

export function resolveDayProgress(
  entries: HabitEntry[] | undefined,
  dateKey: string,
): DayProgress | null {
  if (!entries) return null;
  let value = 0;
  let type: "completion" | "skip" | undefined;
  let targetCountSnapshot: number | undefined;
  for (const e of entries) {
    if (e.date !== dateKey) continue;
    value += e.value;
    // `skip` wins over `completion` if both appear (rare; defensive).
    type = e.type === "skip" ? "skip" : (type ?? e.type ?? "completion");
    targetCountSnapshot = targetCountSnapshot ?? e.targetCountSnapshot;
  }
  if (type === undefined && value === 0) return null;
  return { value, type: type ?? "completion", targetCountSnapshot };
}
