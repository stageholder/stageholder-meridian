import { useMemo } from "react";
import type { CalendarDayData } from "@/lib/api/calendar";
import { useCalendarData } from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import { useUserLight } from "@/lib/api/light";
import type { Habit } from "@repo/core/types";
import type { ActivityRingsData } from "@/components/activity-rings/activity-rings-visual";

interface Targets {
  todoDaily: number;
  journalDailyWords: number;
}

const DEFAULT_TARGETS: Targets = { todoDaily: 3, journalDailyWords: 150 };

function countScheduledHabits(habits: Habit[] | undefined, date: string): number {
  if (!habits) return 0;
  const dow = new Date(date + "T00:00:00").getDay();
  return habits.filter((h) => {
    if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
    return h.scheduledDays.includes(dow);
  }).length;
}

export function computeActivityRings(
  dayData: CalendarDayData | undefined,
  scheduledHabitCount: number,
  targets: Targets = DEFAULT_TARGETS,
): ActivityRingsData {
  if (!dayData) return { todo: 0, habit: 0, journal: 0 };

  const todoDone = dayData.todos.filter((t) => t.status === "done").length;
  const todoPct = Math.min(100, (todoDone / targets.todoDaily) * 100);

  const habitDone = dayData.habitEntries.filter((e) => e.value > 0).length;
  const habitPct = scheduledHabitCount === 0 ? 0 : Math.min(100, (habitDone / scheduledHabitCount) * 100);

  const journalWords = dayData.journals.reduce((sum, j) => sum + (j.wordCount ?? 0), 0);
  // Journal ring is binary: complete if any journal entry exists for the day
  // (matches backend behavior). Word count target is a secondary display-only indicator.
  const journalPct = dayData.journals.length > 0 ? 100 : 0;

  return { todo: todoPct, habit: habitPct, journal: journalPct };
}

export function useActivityRings(date: string) {
  const month = date.slice(0, 7); // yyyy-MM
  const { data: calendarData, isLoading: calLoading, isFetched: calFetched } = useCalendarData(month);
  const { data: habits, isLoading: habitsLoading, isFetched: habitsFetched } = useHabits();
  const { data: userLight } = useUserLight();

  const scheduledHabitCount = useMemo(() => countScheduledHabits(habits, date), [habits, date]);
  const dayData = calendarData?.[date];

  const targets: Targets = useMemo(() => ({
    todoDaily: userLight?.todoTargetDaily ?? DEFAULT_TARGETS.todoDaily,
    journalDailyWords: userLight?.journalTargetDailyWords ?? DEFAULT_TARGETS.journalDailyWords,
  }), [userLight?.todoTargetDaily, userLight?.journalTargetDailyWords]);

  const data = useMemo(
    () => computeActivityRings(dayData, scheduledHabitCount, targets),
    [dayData, scheduledHabitCount, targets],
  );

  const details = useMemo(() => {
    const todoDone = dayData?.todos.filter((t) => t.status === "done").length ?? 0;
    const habitDone = dayData?.habitEntries.filter((e) => e.value > 0).length ?? 0;
    const journalWords = dayData?.journals.reduce((sum, j) => sum + (j.wordCount ?? 0), 0) ?? 0;
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
  }, [dayData, scheduledHabitCount, targets]);

  // Only show loading on first fetch, not on background refetches
  const isInitialLoading = (calLoading && !calFetched) || (habitsLoading && !habitsFetched);
  return { data, isLoading: isInitialLoading, details };
}
