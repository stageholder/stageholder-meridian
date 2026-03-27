"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
} from "date-fns";
import { CalendarCell } from "./calendar-cell";
import type { CalendarData } from "@/lib/api/calendar";
import type { Habit } from "@repo/core/types";

const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date | null;
  calendarData: CalendarData;
  habits: Habit[];
  onSelectDate: (date: Date) => void;
}

export function CalendarGrid({
  currentMonth,
  selectedDate,
  calendarData,
  habits,
  onSelectDate,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1 sm:gap-1">
        {WEEKDAYS_LONG.map((day, i) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          return (
            <CalendarCell
              key={dateKey}
              date={day}
              currentMonth={currentMonth}
              isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
              dayData={calendarData[dateKey]}
              habits={habits}
              onClick={() => onSelectDate(day)}
            />
          );
        })}
      </div>
    </div>
  );
}
