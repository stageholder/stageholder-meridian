import { useMemo } from "react";
import type { CalendarDayData } from "@/lib/api/calendar";
import { useCalendarData } from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import { useUserLight } from "@/lib/api/light";
import { countScheduledHabitsForDate } from "@repo/core/habits/entry-resolution";
import {
  RING_CATEGORY,
  activityRingsConfig,
  computeRingPercentages,
  type ActivityRingsData,
  type ActivityRingsDetails,
} from "@repo/features/activity-rings";

// Re-export the shared activity-rings primitives so legacy PWA call sites
// that imported them from this hook file keep working. The sources of
// truth live in `@repo/features/activity-rings` so the future RN mobile
// app gets the same shape + colors.
export {
  RING_CATEGORY,
  activityRingsConfig,
  type ActivityRingsData,
  type ActivityRingsDetails,
};

interface Targets {
  todoDaily: number;
  journalDailyWords: number;
}

const DEFAULT_TARGETS: Targets = { todoDaily: 3, journalDailyWords: 75 };

/**
 * Per-day ring percentages from the PWA-local `CalendarDayData`. Extracts the
 * raw counts from the calendar day, then delegates the formula to the shared
 * `computeRingPercentages` (@repo/features/activity-rings) so PWA + mobile can
 * never drift apart on the math.
 */
export function computeActivityRings(
  dayData: CalendarDayData | undefined,
  scheduledHabitCount: number,
  targets: Targets = DEFAULT_TARGETS,
  quotaIds: Set<string> = new Set(),
): ActivityRingsData {
  if (!dayData) return { todo: 0, habit: 0, journal: 0 };

  const todoDone = dayData.todos.filter((t) => t.status === "done").length;

  // `weekly_target` (quota) habits aren't day-scheduled, so their entries must
  // not feed the daily habit ring numerator (the denominator already excludes
  // them via countScheduledHabitsForDate).
  const dayHabitEntries = dayData.habitEntries.filter(
    (e) => !quotaIds.has(e.habitId),
  );
  const habitDone = dayHabitEntries.filter((e) => e.value > 0).length;
  const habitSkipped = dayHabitEntries.filter((e) => e.type === "skip").length;

  const journalWords = dayData.journals.reduce(
    (sum, j) => sum + (j.wordCount ?? 0),
    0,
  );

  return computeRingPercentages({
    todo: { done: todoDone, target: targets.todoDaily },
    habit: { done: habitDone + habitSkipped, scheduled: scheduledHabitCount },
    journal: { words: journalWords, target: targets.journalDailyWords },
  });
}

export function useActivityRings(date: string): {
  data: ActivityRingsData;
  isLoading: boolean;
  details: ActivityRingsDetails;
} {
  const month = date.slice(0, 7); // yyyy-MM
  const {
    data: calendarData,
    isLoading: calLoading,
    isFetched: calFetched,
  } = useCalendarData(month);
  const {
    data: habits,
    isLoading: habitsLoading,
    isFetched: habitsFetched,
  } = useHabits();
  const { data: userLight } = useUserLight();

  const scheduledHabitCount = useMemo(
    () => countScheduledHabitsForDate(habits, date),
    [habits, date],
  );
  const quotaIds = useMemo(
    () =>
      new Set(
        (habits ?? [])
          .filter((h) => h.frequency === "weekly_target")
          .map((h) => h.id),
      ),
    [habits],
  );
  const dayData = calendarData?.[date];

  const targets: Targets = useMemo(
    () => ({
      todoDaily: userLight?.todoTargetDaily ?? DEFAULT_TARGETS.todoDaily,
      journalDailyWords:
        userLight?.journalTargetDailyWords ?? DEFAULT_TARGETS.journalDailyWords,
    }),
    [userLight?.todoTargetDaily, userLight?.journalTargetDailyWords],
  );

  const data = useMemo(
    () => computeActivityRings(dayData, scheduledHabitCount, targets, quotaIds),
    [dayData, scheduledHabitCount, targets, quotaIds],
  );

  const details: ActivityRingsDetails = useMemo(() => {
    const todoDone =
      dayData?.todos.filter((t) => t.status === "done").length ?? 0;
    // Exclude quota-habit entries from the daily habit numerator too.
    const dayHabitEntries =
      dayData?.habitEntries.filter((e) => !quotaIds.has(e.habitId)) ?? [];
    const habitDone =
      dayHabitEntries.filter((e) => e.value > 0).length +
      dayHabitEntries.filter((e) => e.type === "skip").length;
    const journalWords =
      dayData?.journals.reduce((sum, j) => sum + (j.wordCount ?? 0), 0) ?? 0;
    const hasJournal = (dayData?.journals.length ?? 0) > 0;
    return {
      todoDone,
      todoTarget: targets.todoDaily,
      habitDone,
      habitTotal: scheduledHabitCount,
      hasJournal,
      journalWords,
      journalTarget: targets.journalDailyWords,
    };
  }, [dayData, scheduledHabitCount, targets, quotaIds]);

  // Only show loading on first fetch, not on background refetches
  const isInitialLoading =
    (calLoading && !calFetched) || (habitsLoading && !habitsFetched);
  return { data, isLoading: isInitialLoading, details };
}
