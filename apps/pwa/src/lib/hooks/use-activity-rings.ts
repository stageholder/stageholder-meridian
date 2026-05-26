import { useMemo } from "react";
import type { ActivityRing } from "@stageholder/ui";
import type { CalendarDayData } from "@/lib/api/calendar";
import { useCalendarData } from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import { useUserLight } from "@/lib/api/light";
import { countScheduledHabitsForDate } from "@/lib/habits/entry-resolution";

/** Per-day completion (0–100) for the three Meridian activity rings. */
export interface ActivityRingsData {
  todo: number;
  habit: number;
  journal: number;
}

/**
 * Meridian's standard category colors — theme-aware CSS vars, shared by the
 * calendar rings, the day panel, and the daily-target header rings. Passed
 * straight through to the kit `<ActivityRings>` as raw SVG stroke colors.
 *   todo = red · habit = orange · journal = yellow
 */
export const RING_CATEGORY = {
  todo: { color: "var(--ring-todo)", track: "var(--ring-todo-track)" },
  habit: { color: "var(--ring-habit)", track: "var(--ring-habit-track)" },
  journal: { color: "var(--ring-journal)", track: "var(--ring-journal-track)" },
} as const;

/**
 * Maps computed completion to the kit `<ActivityRings>` ring config. Order is
 * outer→inner: journal, habit, todo (the kit renders rings[0] outermost),
 * preserving the prior Meridian ring stacking.
 */
export function activityRingsConfig(data: ActivityRingsData): ActivityRing[] {
  return [
    {
      value: data.journal,
      max: 100,
      color: RING_CATEGORY.journal.color,
      trackColor: RING_CATEGORY.journal.track,
      label: "Journal",
    },
    {
      value: data.habit,
      max: 100,
      color: RING_CATEGORY.habit.color,
      trackColor: RING_CATEGORY.habit.track,
      label: "Habits",
    },
    {
      value: data.todo,
      max: 100,
      color: RING_CATEGORY.todo.color,
      trackColor: RING_CATEGORY.todo.track,
      label: "Todos",
    },
  ];
}

interface Targets {
  todoDaily: number;
  journalDailyWords: number;
}

const DEFAULT_TARGETS: Targets = { todoDaily: 3, journalDailyWords: 75 };

export function computeActivityRings(
  dayData: CalendarDayData | undefined,
  scheduledHabitCount: number,
  targets: Targets = DEFAULT_TARGETS,
  quotaIds: Set<string> = new Set(),
): ActivityRingsData {
  if (!dayData) return { todo: 0, habit: 0, journal: 0 };

  const todoDone = dayData.todos.filter((t) => t.status === "done").length;
  const todoPct = Math.min(100, (todoDone / targets.todoDaily) * 100);

  // `weekly_target` (quota) habits aren't day-scheduled, so their entries must
  // not feed the daily habit ring numerator (the denominator already excludes
  // them via countScheduledHabitsForDate).
  const dayHabitEntries = dayData.habitEntries.filter(
    (e) => !quotaIds.has(e.habitId),
  );
  const habitDone = dayHabitEntries.filter((e) => e.value > 0).length;
  const habitSkipped = dayHabitEntries.filter((e) => e.type === "skip").length;
  const habitPct =
    scheduledHabitCount === 0
      ? 0
      : Math.min(100, ((habitDone + habitSkipped) / scheduledHabitCount) * 100);

  const journalWords = dayData.journals.reduce(
    (sum, j) => sum + (j.wordCount ?? 0),
    0,
  );
  const journalPct = Math.min(
    100,
    (journalWords / targets.journalDailyWords) * 100,
  );

  return { todo: todoPct, habit: habitPct, journal: journalPct };
}

export function useActivityRings(date: string) {
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

  const details = useMemo(() => {
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
