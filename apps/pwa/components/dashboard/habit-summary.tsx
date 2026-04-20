"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useHabits } from "@/lib/api/habits";
import { useCalendarData } from "@/lib/api/calendar";
import { BentoCard } from "./bento-card";
import type { Habit } from "@repo/core/types";
import { resolveTargetCount } from "@/lib/habits/entry-resolution";

export function HabitSummary({
  index = 0,
  className,
}: {
  index?: number;
  className?: string;
}) {
  const { data: habits, isLoading: habitsLoading } = useHabits();
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: calendarData, isLoading: calendarLoading } =
    useCalendarData(currentMonth);

  const today = format(new Date(), "yyyy-MM-dd");

  const habitProgress = useMemo(() => {
    if (!habits || !calendarData?.[today])
      return new Map<
        string,
        { value: number; type?: string; targetCountSnapshot?: number }
      >();
    const valueMap = new Map<
      string,
      { value: number; type?: string; targetCountSnapshot?: number }
    >();
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

  const isLoading = habitsLoading || calendarLoading;

  return (
    <BentoCard
      title="Habits Today"
      href="/app/habits"
      index={index}
      className={className}
      action={
        <Link
          href="/app/habits"
          className="text-xs text-primary hover:underline"
        >
          View all
        </Link>
      }
    >
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : habits && habits.length > 0 ? (
          habits.slice(0, 5).map((habit: Habit) => {
            const todayDow = new Date().getDay();
            const isScheduledToday =
              !habit.scheduledDays ||
              habit.scheduledDays.length === 0 ||
              habit.scheduledDays.includes(todayDow);
            const progress = habitProgress.get(habit.id);
            const value = progress?.value ?? 0;
            const isSkipped = progress?.type === "skip";
            const target = resolveTargetCount(
              { targetCountSnapshot: progress?.targetCountSnapshot },
              habit,
            );
            const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
            const isComplete = !isSkipped && value >= target;

            if (!isScheduledToday) {
              return (
                <div key={habit.id} className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm text-muted-foreground">
                    {habit.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    Rest day
                  </span>
                </div>
              );
            }

            if (isSkipped) {
              return (
                <div key={habit.id} className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm text-muted-foreground">
                    {habit.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    Skipped
                  </span>
                </div>
              );
            }

            return (
              <div key={habit.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "truncate text-sm",
                      isComplete
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}
                  >
                    {habit.name}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {value}/{target}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isComplete
                        ? "bg-green-500 dark:bg-green-400"
                        : "bg-orange-500 dark:bg-orange-400",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">
            No habits to track yet.
          </p>
        )}
      </div>
    </BentoCard>
  );
}
