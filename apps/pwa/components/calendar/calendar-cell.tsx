"use client";

import { cn } from "@/lib/utils";
import { isToday, isSameMonth } from "date-fns";
import { ActivityRingsVisual } from "@/components/activity-rings";
import { computeActivityRings } from "@/components/activity-rings";
import type { CalendarDayData } from "@/lib/api/calendar";
import type { Habit } from "@repo/core/types";

function countScheduledHabits(habits: Habit[], date: Date): number {
  const dow = date.getDay();
  return habits.filter((h) => {
    if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
    return h.scheduledDays.includes(dow);
  }).length;
}

interface CalendarCellProps {
  date: Date;
  currentMonth: Date;
  isSelected: boolean;
  dayData?: CalendarDayData;
  habits: Habit[];
  onClick: () => void;
}

export function CalendarCell({
  date,
  currentMonth,
  isSelected,
  dayData,
  habits,
  onClick,
}: CalendarCellProps) {
  const today = isToday(date);
  const inMonth = isSameMonth(date, currentMonth);

  const hasData =
    (dayData?.todos?.length ?? 0) > 0 ||
    (dayData?.journals?.length ?? 0) > 0 ||
    (dayData?.habitEntries?.length ?? 0) > 0;

  const scheduledCount = countScheduledHabits(habits, date);
  const ringsData = hasData
    ? computeActivityRings(dayData, scheduledCount)
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg p-1 text-xs transition-colors min-h-[48px] sm:gap-1 sm:p-2 sm:text-sm sm:min-h-[60px]",
        inMonth ? "text-foreground" : "text-muted-foreground/50",
        isSelected && "bg-accent ring-1 ring-primary",
        !isSelected && "hover:bg-accent/50",
        today && !isSelected && "bg-primary/10",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:w-7 sm:text-sm",
          today && "bg-primary text-primary-foreground",
        )}
      >
        {date.getDate()}
      </span>
      {ringsData ? (
        <ActivityRingsVisual data={ringsData} size="xs" animate={false} />
      ) : (
        <div className="h-6" />
      )}
    </button>
  );
}
