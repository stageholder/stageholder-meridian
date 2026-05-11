// apps/mobile/lib/api/hooks/today.ts
//
// Today-aggregate hooks used by the dashboard. These compose the
// per-resource hooks rather than introducing new endpoints, so the cache
// invalidation graph stays simple: invalidating habit entries invalidates
// the dashboard automatically.
//
// Why `useQueries` for entries: the Today dashboard needs to know how
// many habits are checked-in today, which requires entries for EVERY
// visible habit. We fire all the entry queries in parallel via
// useQueries — same as one hook returning a stream, but each habit's
// entry cache is independently invalidatable and indexable.

import { useQueries } from "@tanstack/react-query";
import type { Habit, HabitEntry } from "@repo/core/types";

import { apiClient } from "../client";
import { habitKeys } from "../keys";
import { computeStreak, isCheckedToday, isScheduledToday } from "@/lib/streak";

import { useHabits } from "./habits";

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
 */
export function useTodayHabitProgress(): {
  data: TodayHabitProgress | null;
  isLoading: boolean;
} {
  const habitsQuery = useHabits();
  const habits: Habit[] = habitsQuery.data ?? [];

  const entriesQueries = useQueries({
    queries: habits.map((h) => ({
      queryKey: habitKeys.entries(h.id),
      queryFn: async () => {
        const { data } = await apiClient.get<
          { data: HabitEntry[] } | HabitEntry[]
        >(`/habits/${h.id}/entries`);
        return Array.isArray(data) ? data : data.data;
      },
    })),
  });

  const isLoading =
    habitsQuery.isLoading || entriesQueries.some((q) => q.isLoading);

  if (habitsQuery.isLoading) {
    return { data: null, isLoading: true };
  }

  // Even if entry queries are still loading, we can derive the "scheduled
  // today" count from habits alone — useful so the totals don't appear as
  // 0/0 during the first paint.
  const scheduled = habits.filter((h) => isScheduledToday(h.scheduledDays));

  if (entriesQueries.some((q) => q.isLoading)) {
    return {
      data: {
        doneToday: 0,
        totalScheduledToday: scheduled.length,
        bestStreak: 0,
      },
      isLoading: true,
    };
  }

  let doneToday = 0;
  let bestStreak = 0;
  habits.forEach((h, i) => {
    const entries = entriesQueries[i]?.data ?? [];
    if (isScheduledToday(h.scheduledDays) && isCheckedToday(entries)) {
      doneToday += 1;
    }
    const streak = computeStreak(entries, h.scheduledDays);
    if (streak > bestStreak) bestStreak = streak;
  });

  return {
    data: {
      doneToday,
      totalScheduledToday: scheduled.length,
      bestStreak,
    },
    isLoading,
  };
}
