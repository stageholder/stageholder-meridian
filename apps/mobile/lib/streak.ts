// apps/mobile/lib/streak.ts
//
// Pure functions for streak math. The server is the source of truth for
// HabitEntry rows; we compute the streak client-side because:
//
//   1. It avoids a round-trip on every render that needs to display the
//      streak (HabitCard, Today dashboard).
//   2. The streak shape is opinionated (skip-days don't break it, off-days
//      are skipped not counted, today's entry being absent doesn't break
//      it if the day isn't over) — pushing that into the API forces the
//      server to know about our UX conventions.
//
// Mirrors the PWA's `lib/habits/entry-resolution.ts` logic so streaks
// display identically across surfaces.

import type { HabitEntry } from "@repo/core/types";

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
 * days, counting consecutive completions. Skipped days (`type === "skip"`)
 * don't break the chain. Off-days (not in `scheduledDays`) are skipped
 * silently. Today not being checked yet doesn't break the streak unless
 * the day is already over (we don't penalize people for streaks before
 * bedtime).
 *
 * Caps at 365 to avoid pathological scans.
 */
export function computeStreak(
  entries: HabitEntry[] | undefined,
  scheduledDays?: number[],
): number {
  if (!entries || entries.length === 0) return 0;

  const byDate = new Map<string, HabitEntry>();
  for (const e of entries) byDate.set(e.date, e);

  const isScheduled = (dow: number) =>
    !scheduledDays || scheduledDays.length === 0 || scheduledDays.includes(dow);

  const today = new Date();
  const todayKey = localDateKey(today);
  const hasTodayCompletion =
    byDate.get(todayKey)?.type === "completion" ||
    (byDate.get(todayKey)?.value ?? 0) > 0;

  // Anchor: today if checked today, otherwise yesterday (chain alive until
  // the day actually ends).
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
      // Skip days preserve the chain but don't add to it.
      cursor = prevDay(cursor);
      continue;
    }
    // Fail breaks the chain even though the entry exists — it's an explicit
    // user-declared miss. We check this before the value-based completion
    // check so a value=0 fail entry isn't misread as just "an open day".
    if (entry?.type === "fail") break;
    if (entry && entry.value > 0) {
      streak += 1;
      cursor = prevDay(cursor);
      continue;
    }
    // First scheduled, non-skipped, non-fail day without a completion →
    // chain broken. This also covers the auto-fail case: a past scheduled
    // day with no entry at all reads the same as an explicit fail.
    break;
  }

  return streak;
}

/** Has the habit been completed today (any positive entry for `localDateKey()`)? */
export function isCheckedToday(entries: HabitEntry[] | undefined): boolean {
  if (!entries) return false;
  const today = localDateKey();
  const e = entries.find((x) => x.date === today);
  return !!e && e.type !== "skip" && e.value > 0;
}

/** Pulled out so the Today dashboard + HabitCard share the "should I show?" check. */
export function isScheduledToday(
  scheduledDays?: number[],
  at: Date = new Date(),
): boolean {
  if (!scheduledDays || scheduledDays.length === 0) return true;
  return scheduledDays.includes(at.getDay());
}
