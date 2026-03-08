import { useMemo } from "react";
import type { CalendarDayData } from "@/lib/api/calendar";
import { useCalendarData } from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import { useUserLight } from "@/lib/api/light";
import type { ActivityRingsData } from "@/components/activity-rings/activity-rings-visual";

interface Targets {
  todoDaily: number;
  journalDailyWords: number;
}

const DEFAULT_TARGETS: Targets = { todoDaily: 3, journalDailyWords: 150 };

export function computeActivityRings(
  dayData: CalendarDayData | undefined,
  totalHabits: number,
  targets: Targets = DEFAULT_TARGETS,
): ActivityRingsData {
  if (!dayData) return { todo: 100, habit: 100, journal: 0 };

  const todoDone = dayData.todos.filter((t) => t.status === "done").length;
  const todoPct = Math.min(100, (todoDone / targets.todoDaily) * 100);

  const habitDone = dayData.habitEntries.filter((e) => e.value > 0).length;
  const habitPct = totalHabits === 0 ? 100 : (habitDone / totalHabits) * 100;

  const journalWords = dayData.journals.reduce((sum, j) => sum + (j.wordCount ?? 0), 0);
  const journalPct = Math.min(100, (journalWords / targets.journalDailyWords) * 100);

  return { todo: todoPct, habit: habitPct, journal: journalPct };
}

export function useActivityRings(date: string) {
  const month = date.slice(0, 7); // yyyy-MM
  const { data: calendarData, isLoading: calLoading, isFetched: calFetched } = useCalendarData(month);
  const { data: habits, isLoading: habitsLoading, isFetched: habitsFetched } = useHabits();
  const { data: userLight } = useUserLight();

  const totalHabits = habits?.length ?? 0;
  const dayData = calendarData?.[date];

  const targets: Targets = useMemo(() => ({
    todoDaily: userLight?.todoTargetDaily ?? DEFAULT_TARGETS.todoDaily,
    journalDailyWords: userLight?.journalTargetDailyWords ?? DEFAULT_TARGETS.journalDailyWords,
  }), [userLight?.todoTargetDaily, userLight?.journalTargetDailyWords]);

  const data = useMemo(
    () => computeActivityRings(dayData, totalHabits, targets),
    [dayData, totalHabits, targets],
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
      habitTotal: totalHabits,
      hasJournal,
      journalWords,
      journalTarget: targets.journalDailyWords,
    };
  }, [dayData, totalHabits, targets]);

  // Only show loading on first fetch, not on background refetches
  const isInitialLoading = (calLoading && !calFetched) || (habitsLoading && !habitsFetched);
  return { data, isLoading: isInitialLoading, details };
}
