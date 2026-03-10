import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useCalendarData } from "@/lib/api/calendar";

interface WeeklyActivityDay {
  date: string;
  label: string;
  todos: number;
  habits: number;
  journals: number;
}

export function useWeeklyActivity() {
  const today = new Date();
  const currentMonth = format(today, "yyyy-MM");
  const sevenDaysAgo = subDays(today, 6);
  const prevMonth = format(sevenDaysAgo, "yyyy-MM");

  const { data: currentData, isLoading: currentLoading } = useCalendarData(currentMonth);
  const { data: prevData, isLoading: prevLoading } = useCalendarData(prevMonth);

  const needsPrevMonth = prevMonth !== currentMonth;

  const data = useMemo(() => {
    const days: WeeklyActivityDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const monthStr = format(d, "yyyy-MM");
      const calData = monthStr === currentMonth ? currentData : prevData;
      const dayData = calData?.[dateStr];

      days.push({
        date: dateStr,
        label: format(d, "EEE"),
        todos: dayData?.todos.filter((t) => t.status === "done").length ?? 0,
        habits: new Set(dayData?.habitEntries.map((e) => e.habitId) ?? []).size,
        journals: dayData?.journals.length ?? 0,
      });
    }
    return days;
  }, [currentData, prevData, currentMonth]);

  return {
    data,
    isLoading: currentLoading || (needsPrevMonth && prevLoading),
  };
}
