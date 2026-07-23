// apps/mobile/lib/api/hooks/today.ts
//
// Today-aggregate hooks used by the dashboard. These compose the
// per-resource hooks rather than introducing new endpoints, so the cache
// invalidation graph stays simple: writing a habit entry updates the
// dashboard automatically through the shared caches.
//
// Why `useQueries` for entries: the Today dashboard needs to know how
// many habits are checked-in today, which requires entries for EVERY
// visible habit. We fire all the entry queries in parallel via
// useQueries — each keyed on the SAME canonical 90-day window
// (`habitEntriesWindow`) the habit cards and check-in rows use, so the
// dashboard adds ZERO extra cache entries or network requests beyond what
// the habits screen already fetched. (The old version fetched an
// UNWINDOWED variant — a third cache key per habit.)

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Habit, HabitEntry } from "@repo/core/types";

import { apiClient } from "../client";
import { habitKeys } from "../keys";
import {
  computeStreakCached,
  isCheckedToday,
  isScheduledToday,
} from "@/lib/streak";

import { habitEntriesWindow, useHabits } from "./habits";

// NOTE: the month-calendar hook lives in ./calendar (`useCalendarData` →
// `CalendarData`, envelope-unwrapped + Array.isArray-normalized). An earlier
// duplicate here collided on the `["calendar", month]` key with a divergent
// shape; it was removed so there is a single source of truth.

export type TodayHabitProgress = {
  doneToday: number;
  totalScheduledToday: number;
  bestStreak: number;
};

/**
 * Parallel-fetches entries for every habit and derives:
 *   - how many scheduled-today habits are checked
 *   - the highest current streak across all habits
 *
 * Both feed the Today dashboard's ActivityRings + streak strip. Returns
 * `null` while the underlying queries are loading (no flicker — the
 * dashboard shows a skeleton until both habits and entries are ready).
 *
 * PERF: the derivation (per-habit ≤365-day streak walk) used to run INLINE
 * on every render of every consumer. It's now memoized on the queries'
 * dataUpdatedAt stamps, and each streak goes through `computeStreakCached`
 * (entries-identity keyed), so a re-render without new data costs nothing.
 */
export function useTodayHabitProgress(): {
  data: TodayHabitProgress | null;
  isLoading: boolean;
} {
  const habitsQuery = useHabits();
  const habits: Habit[] = useMemo(
    () => habitsQuery.data ?? [],
    [habitsQuery.data],
  );

  const window = habitEntriesWindow();
  const entriesQueries = useQueries({
    queries: habits.map((h) => ({
      // Same key shape as useSharedHabitEntries — dedupes with the habit
      // cards' and check-in rows' queries instead of adding a third window.
      queryKey: [...habitKeys.entries(h.id), window] as const,
      queryFn: async () => {
        const { data } = await apiClient.get<
          { data: HabitEntry[] } | HabitEntry[]
        >(`/habits/${h.id}/entries`, { params: window });
        return Array.isArray(data) ? data : data.data;
      },
    })),
  });

  const habitsLoading = habitsQuery.isLoading;
  const entriesLoading = entriesQueries.some((q) => q.isLoading);
  // Cheap change stamp — recompute the aggregate only when some entries
  // query actually delivered new data (not on unrelated re-renders).
  const entriesStamp = entriesQueries.map((q) => q.dataUpdatedAt).join(",");

  const data = useMemo<TodayHabitProgress | null>(() => {
    if (habitsLoading) return null;

    // Even if entry queries are still loading, we can derive the "scheduled
    // today" count from habits alone — useful so the totals don't appear as
    // 0/0 during the first paint.
    const scheduled = habits.filter((h) => isScheduledToday(h.scheduledDays));

    if (entriesLoading) {
      return {
        doneToday: 0,
        totalScheduledToday: scheduled.length,
        bestStreak: 0,
      };
    }

    let doneToday = 0;
    let bestStreak = 0;
    habits.forEach((h, i) => {
      const entries = entriesQueries[i]?.data ?? [];
      if (isScheduledToday(h.scheduledDays) && isCheckedToday(entries)) {
        doneToday += 1;
      }
      const streak = computeStreakCached(h.id, entries, h.scheduledDays);
      if (streak > bestStreak) bestStreak = streak;
    });

    return {
      doneToday,
      totalScheduledToday: scheduled.length,
      bestStreak,
    };
    // entriesQueries' contents are captured via entriesStamp — the array
    // itself is a fresh object every render by useQueries' design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, habitsLoading, entriesLoading, entriesStamp]);

  return { data, isLoading: habitsLoading || entriesLoading };
}
