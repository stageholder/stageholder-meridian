import { useMemo } from "react";
import { format } from "date-fns";
import { HabitSummary as HabitSummaryView } from "@repo/features/dashboard";
import type { HabitProgressValue } from "@repo/features/dashboard";
import { useHabits } from "@/lib/api/habits";
import { useCalendarData } from "@/lib/api/calendar";

/**
 * PWA data wrapper: hooks `useHabits` + `useCalendarData`, computes the
 * per-habit progress map from today's calendar entries, and renders the shared
 * CONTENT-ONLY view. Card chrome + "View all" nav are owned by the host route's
 * kit `Dashboard.Widget`.
 */
export function HabitSummary() {
  const { data: habits, isLoading: habitsLoading } = useHabits();
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: calendarData, isLoading: calendarLoading } =
    useCalendarData(currentMonth);

  const today = format(new Date(), "yyyy-MM-dd");

  const habitProgress = useMemo(() => {
    const valueMap = new Map<string, HabitProgressValue>();
    if (!habits || !calendarData?.[today]) return valueMap;
    for (const entry of calendarData[today].habitEntries) {
      const existing = valueMap.get(entry.habitId);
      valueMap.set(entry.habitId, {
        value: (existing?.value ?? 0) + entry.value,
        type: entry.type || existing?.type || "completion",
        targetCountSnapshot:
          existing?.targetCountSnapshot ?? entry.targetCountSnapshot,
      });
    }
    return valueMap;
  }, [calendarData, habits, today]);

  return (
    <HabitSummaryView
      habits={habits}
      habitProgress={habitProgress}
      isLoading={habitsLoading || calendarLoading}
    />
  );
}
