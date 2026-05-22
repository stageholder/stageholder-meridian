import { useState, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { Text, XStack, YStack } from "@stageholder/ui";
import { CalendarHeader } from "./calendar-header";
import { CalendarGrid } from "./calendar-grid";
import { DayPanel } from "./day-panel";
import { useCalendarData } from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import type { CalendarDayData } from "@/lib/api/calendar";

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthKey = format(currentMonth, "yyyy-MM");
  const { data: calendarData, isLoading, isError } = useCalendarData(monthKey);
  const { data: habits } = useHabits();
  const habitsList = habits ?? [];

  const selectedDayData: CalendarDayData | undefined = useMemo(() => {
    if (!selectedDate || !calendarData) return undefined;
    const key = format(selectedDate, "yyyy-MM-dd");
    return calendarData[key];
  }, [selectedDate, calendarData]);

  return (
    <YStack gap="$4">
      <CalendarHeader
        currentMonth={currentMonth}
        onPrevMonth={() => setCurrentMonth((m) => subMonths(m, 1))}
        onNextMonth={() => setCurrentMonth((m) => addMonths(m, 1))}
        onToday={() => {
          setCurrentMonth(startOfMonth(new Date()));
          setSelectedDate(new Date());
        }}
      />

      {isLoading ? (
        <XStack height={400} items="center" justify="center">
          <Text fontSize="$3" color="$mutedForeground">
            Loading calendar...
          </Text>
        </XStack>
      ) : isError ? (
        <XStack height={400} items="center" justify="center">
          <Text fontSize="$3" color="$destructive">
            Failed to load calendar. Please try refreshing the page.
          </Text>
        </XStack>
      ) : (
        <CalendarGrid
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          calendarData={calendarData || {}}
          habits={habitsList}
          onSelectDate={setSelectedDate}
        />
      )}

      {selectedDate && (
        <DayPanel
          date={selectedDate}
          dayData={
            selectedDayData || { todos: [], journals: [], habitEntries: [] }
          }
          habits={habitsList}
        />
      )}
    </YStack>
  );
}
