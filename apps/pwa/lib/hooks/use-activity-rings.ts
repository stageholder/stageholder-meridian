import { useMemo } from "react";
import type { CalendarDayData } from "@/lib/api/calendar";
import { useCalendarData } from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import type { ActivityRingsData } from "@/components/activity-rings/activity-rings-visual";

export function computeActivityRings(
  dayData: CalendarDayData | undefined,
  totalHabits: number,
): ActivityRingsData {
  if (!dayData) return { todo: 100, habit: 100, journal: 0 };

  const todoTotal = dayData.todos.length;
  const todoDone = dayData.todos.filter((t) => t.status === "done").length;
  const todoPct = todoTotal === 0 ? 100 : (todoDone / todoTotal) * 100;

  const habitDone = dayData.habitEntries.filter((e) => e.value > 0).length;
  const habitPct = totalHabits === 0 ? 100 : (habitDone / totalHabits) * 100;

  const journalPct = dayData.journals.length > 0 ? 100 : 0;

  return { todo: todoPct, habit: habitPct, journal: journalPct };
}

export function useActivityRings(date: string) {
  const month = date.slice(0, 7); // yyyy-MM
  const { data: calendarData, isLoading: calLoading, isFetched: calFetched } = useCalendarData(month);
  const { data: habits, isLoading: habitsLoading, isFetched: habitsFetched } = useHabits();

  const totalHabits = habits?.length ?? 0;
  const dayData = calendarData?.[date];

  const data = useMemo(
    () => computeActivityRings(dayData, totalHabits),
    [dayData, totalHabits],
  );

  const details = useMemo(() => {
    const todoTotal = dayData?.todos.length ?? 0;
    const todoDone = dayData?.todos.filter((t) => t.status === "done").length ?? 0;
    const habitDone = dayData?.habitEntries.filter((e) => e.value > 0).length ?? 0;
    const hasJournal = (dayData?.journals.length ?? 0) > 0;
    return { todoDone, todoTotal, habitDone, habitTotal: totalHabits, hasJournal };
  }, [dayData, totalHabits]);

  // Only show loading on first fetch, not on background refetches
  const isInitialLoading = (calLoading && !calFetched) || (habitsLoading && !habitsFetched);
  return { data, isLoading: isInitialLoading, details };
}
