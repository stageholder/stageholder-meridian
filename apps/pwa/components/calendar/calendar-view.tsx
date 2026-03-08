"use client";

import { useState, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { CalendarHeader } from "./calendar-header";
import { CalendarGrid } from "./calendar-grid";
import { DayPanel } from "./day-panel";
import { useCalendarData } from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import type { CalendarDayData } from "@/lib/api/calendar";
import type { Habit } from "@repo/core/types";

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthKey = format(currentMonth, "yyyy-MM");
  const { data: calendarData, isLoading } = useCalendarData(monthKey);
  const { data: habits } = useHabits();
  const habitsList = habits ?? [];

  const selectedDayData: CalendarDayData | undefined = useMemo(() => {
    if (!selectedDate || !calendarData) return undefined;
    const key = format(selectedDate, "yyyy-MM-dd");
    return calendarData[key];
  }, [selectedDate, calendarData]);

  return (
    <div className="space-y-4">
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
        <div className="flex h-[400px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading calendar...</p>
        </div>
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
          dayData={selectedDayData || { todos: [], journals: [], habitEntries: [] }}
          habits={habitsList}
        />
      )}
    </div>
  );
}
