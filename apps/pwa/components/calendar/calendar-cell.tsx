"use client";

import { cn } from "@/lib/utils";
import { isToday, isSameMonth } from "date-fns";
import type { CalendarDayData } from "@/lib/api/calendar";

interface CalendarCellProps {
  date: Date;
  currentMonth: Date;
  isSelected: boolean;
  dayData?: CalendarDayData;
  onClick: () => void;
}

export function CalendarCell({ date, currentMonth, isSelected, dayData, onClick }: CalendarCellProps) {
  const today = isToday(date);
  const inMonth = isSameMonth(date, currentMonth);

  const hasTodos = (dayData?.todos?.length ?? 0) > 0;
  const hasJournals = (dayData?.journals?.length ?? 0) > 0;
  const hasHabits = (dayData?.habitEntries?.length ?? 0) > 0;

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
      <div className="flex items-center gap-1">
        {hasTodos && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
        {hasJournals && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
        {hasHabits && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
      </div>
    </button>
  );
}
