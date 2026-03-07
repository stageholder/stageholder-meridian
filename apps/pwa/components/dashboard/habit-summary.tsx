"use client";

import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useHabits, useHabitEntries } from "@/lib/api/habits";
import { useWorkspace } from "@/lib/workspace-context";
import type { Habit, HabitEntry } from "@repo/core/types";

function HabitSummaryItem({ habit }: { habit: Habit }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: entries } = useHabitEntries(habit.id, {
    startDate: today,
    endDate: today,
  });

  const isCheckedIn = (entries || []).some(
    (e: HabitEntry) => e.date.split("T")[0] === today
  );

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full text-xs",
          isCheckedIn
            ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isCheckedIn ? (
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
          isCheckedIn ? "text-muted-foreground line-through" : "text-foreground"
        )}
      >
        {habit.name}
      </span>
    </div>
  );
}

export function HabitSummary() {
  const { workspace } = useWorkspace();
  const { data: habits, isLoading } = useHabits();

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
          habits.slice(0, 5).map((habit: Habit) => (
            <HabitSummaryItem key={habit.id} habit={habit} />
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No habits to track yet.</p>
        )}
      </div>
    </div>
  );
}
