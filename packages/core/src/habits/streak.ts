// packages/core/src/habits/streak.ts
//
// Pure, cross-platform streak math. Single source of truth for BOTH apps and
// the API (GET /dashboard/today server-computed currentStreak). Lifted from
// apps/mobile/lib/streak.ts (which now re-exports from here) so the streak a
// user sees is byte-identical everywhere.

import type { HabitEntry } from "../types";

/** yyyy-mm-dd in the local timezone. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverse of localDateKey — local-midnight Date from "yyyy-mm-dd". */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function prevDay(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return x;
}

/**
 * Compute the current streak. Walks backwards from today through scheduled
 * days, counting consecutive completions. Skip preserves the chain; fail (or a
 * past scheduled day with no entry) breaks it; today-not-yet-checked doesn't
 * break it. Caps at 365.
 */
export function computeStreak(
  entries: HabitEntry[] | undefined,
  scheduledDays?: number[],
  /** Anchor "today" as a yyyy-mm-dd key. Client callers omit it (wall clock =
   *  the user's local day). The SERVER (GET /dashboard/today) passes the
   *  client's `today` so a server in a different timezone doesn't anchor the
   *  streak on the wrong day near midnight. */
  todayKey?: string,
): number {
  if (!entries || entries.length === 0) return 0;

  const byDate = new Map<string, HabitEntry>();
  for (const e of entries) byDate.set(e.date, e);

  const isScheduled = (dow: number) =>
    !scheduledDays || scheduledDays.length === 0 || scheduledDays.includes(dow);

  // When a `todayKey` override is given, anchor on its local-midnight Date so
  // the backward walk (prevDay/getDay) still works; otherwise use the wall clock.
  const today = todayKey ? fromDateKey(todayKey) : new Date();
  const resolvedTodayKey = todayKey ?? localDateKey(today);
  const hasTodayCompletion =
    byDate.get(resolvedTodayKey)?.type === "completion" ||
    (byDate.get(resolvedTodayKey)?.value ?? 0) > 0;

  let cursor: Date = hasTodayCompletion ? today : prevDay(today);
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const dow = cursor.getDay();
    const key = localDateKey(cursor);

    if (!isScheduled(dow)) {
      cursor = prevDay(cursor);
      continue;
    }

    const entry = byDate.get(key);
    if (entry?.type === "skip") {
      cursor = prevDay(cursor);
      continue;
    }
    if (entry?.type === "fail") break;
    if (entry && entry.value > 0) {
      streak += 1;
      cursor = prevDay(cursor);
      continue;
    }
    break;
  }

  return streak;
}

const streakCache = new Map<
  string,
  {
    entries: HabitEntry[] | undefined;
    todayKey: string;
    scheduled: number[] | undefined;
    value: number;
  }
>();

/** `computeStreak` with an identity-keyed per-habit cache — use in render
 *  paths that recompute across many habits. */
export function computeStreakCached(
  habitId: string,
  entries: HabitEntry[] | undefined,
  scheduledDays?: number[],
): number {
  const todayKey = localDateKey();
  const hit = streakCache.get(habitId);
  if (
    hit &&
    hit.entries === entries &&
    hit.todayKey === todayKey &&
    hit.scheduled === scheduledDays
  ) {
    return hit.value;
  }
  const value = computeStreak(entries, scheduledDays);
  streakCache.set(habitId, {
    entries,
    todayKey,
    scheduled: scheduledDays,
    value,
  });
  return value;
}

/** Has the habit been completed on `todayKey` (any positive, non-skip entry)?
 *  `todayKey` defaults to the wall clock; pass it explicitly wherever the
 *  caller has already pinned a day, so a long-lived screen that crosses
 *  midnight can't mix two different "today"s in one derivation. */
export function isCheckedToday(
  entries: HabitEntry[] | undefined,
  todayKey: string = localDateKey(),
): boolean {
  if (!entries) return false;
  const e = entries.find((x) => x.date === todayKey);
  return !!e && e.type !== "skip" && e.value > 0;
}

/** Should the habit show on the given day? Accepts either a yyyy-mm-dd key or a
 *  Date; defaults to the wall clock. Prefer passing the caller's pinned day —
 *  see `isCheckedToday`. */
export function isScheduledToday(
  scheduledDays?: number[],
  at: Date | string = new Date(),
): boolean {
  if (!scheduledDays || scheduledDays.length === 0) return true;
  const day = typeof at === "string" ? fromDateKey(at) : at;
  return scheduledDays.includes(day.getDay());
}
