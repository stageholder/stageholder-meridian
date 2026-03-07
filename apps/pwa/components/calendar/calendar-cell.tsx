"use client";

import { cn } from "@/lib/utils";
import { isToday, isSameMonth } from "date-fns";
import { ActivityRingsVisual } from "@/components/activity-rings";
import { computeActivityRings } from "@/components/activity-rings";
import type { CalendarDayData } from "@/lib/api/calendar";

interface CalendarCellProps {
  date: Date;
  currentMonth: Date;
  isSelected: boolean;
  dayData?: CalendarDayData;
  totalHabits: number;
  onClick: () => void;
}

export function CalendarCell({ date, currentMonth, isSelected, dayData, totalHabits, onClick }: CalendarCellProps) {
  const today = isToday(date);
  const inMonth = isSameMonth(date, currentMonth);

  const hasData = (dayData?.todos?.length ?? 0) > 0
    || (dayData?.journals?.length ?? 0) > 0
    || (dayData?.habitEntries?.length ?? 0) > 0;

  const ringsData = hasData ? computeActivityRings(dayData, totalHabits) : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg p-2 text-sm transition-colors min-h-[60px]",
        inMonth ? "text-foreground" : "text-muted-foreground/50",
        isSelected && "bg-accent ring-1 ring-primary",
        !isSelected && "hover:bg-accent/50",
        today && !isSelected && "bg-primary/10",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
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
