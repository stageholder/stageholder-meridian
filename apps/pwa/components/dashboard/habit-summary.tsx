"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useHabits } from "@/lib/api/habits";
import { useCalendarData } from "@/lib/api/calendar";
import { useWorkspace } from "@/lib/workspace-context";
import type { Habit } from "@repo/core/types";

export function HabitSummary() {
  const { workspace } = useWorkspace();
  const { data: habits, isLoading: habitsLoading } = useHabits();
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: calendarData, isLoading: calendarLoading } = useCalendarData(currentMonth);

  const today = format(new Date(), "yyyy-MM-dd");

  const completedHabitIds = useMemo(() => {
    const ids = new Set<string>();
    if (!calendarData || !calendarData[today]) return ids;

    const todayEntries = calendarData[today].habitEntries;
    // Aggregate values per habitId
    const valueMap = new Map<string, number>();
    for (const entry of todayEntries) {
      valueMap.set(entry.habitId, (valueMap.get(entry.habitId) ?? 0) + entry.value);
    }

    // Cross-reference with habits to check completion
    if (habits) {
      for (const habit of habits) {
        const val = valueMap.get(habit.id) ?? 0;
        if (val >= habit.targetCount) {
          ids.add(habit.id);
        }
      }
    }

    return ids;
  }, [calendarData, habits, today]);

  const checkedInHabitIds = useMemo(() => {
    const ids = new Set<string>();
    if (!calendarData || !calendarData[today]) return ids;
    for (const entry of calendarData[today].habitEntries) {
      ids.add(entry.habitId);
    }
    return ids;
  }, [calendarData, today]);

  const isLoading = habitsLoading || calendarLoading;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Habits Today</h3>
        <Link href={`/${workspace.shortId}/habits`} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : habits && habits.length > 0 ? (
          habits.slice(0, 5).map((habit: Habit) => {
            const isComplete = completedHabitIds.has(habit.id);
            const hasEntry = checkedInHabitIds.has(habit.id);

            return (
              <div key={habit.id} className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isComplete
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : hasEntry
                        ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="block h-2 w-2 rounded-full bg-current" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm",
                    isComplete ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {habit.name}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">No habits to track yet.</p>
        )}
      </div>
    </div>
  );
}
