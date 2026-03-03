"use client";

import { cn } from "@/lib/utils";
import { HabitStreak } from "./habit-streak";
import { useCreateHabitEntry, useHabitEntries } from "@/lib/api/habits";
import { toast } from "sonner";
import type { Habit, HabitEntry } from "@repo/core/types";

interface HabitCardProps {
  habit: Habit;
}

export function HabitCard({ habit }: HabitCardProps) {
  const today = new Date().toISOString().split("T")[0]!;
  const { data: entries } = useHabitEntries(habit.id, {
    startDate: getWeekStart(),
    endDate: today,
  });
  const createEntry = useCreateHabitEntry();

  const todayEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === today
  );
  const isCheckedIn = !!todayEntry;

  // Calculate streak from entries
  const streak = calculateStreak(entries || []);

  function handleCheckIn() {
    if (isCheckedIn) return;

    createEntry.mutate(
      {
        habitId: habit.id,
        data: { date: today, value: 1 },
      },
      {
        onSuccess: () => {
          toast.success(`Checked in for ${habit.name}`);
        },
        onError: () => {
          toast.error("Failed to check in");
        },
      }
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: (habit.color || "#3b82f6") + "20" }}
          >
            {habit.icon || habit.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{habit.name}</h3>
            {habit.description && (
              <p className="text-xs text-muted-foreground">{habit.description}</p>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground capitalize">{habit.frequency}</span>
      </div>

      <div className="mt-4">
        <HabitStreak currentStreak={streak} targetCount={habit.targetCount} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {habit.unit ? `${habit.targetCount} ${habit.unit}` : `${habit.targetCount}x target`}
        </span>
        <button
          onClick={handleCheckIn}
          disabled={isCheckedIn || createEntry.isPending}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            isCheckedIn
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          )}
        >
          {isCheckedIn ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Done
            </>
          ) : createEntry.isPending ? (
            "Checking..."
          ) : (
            "Check In"
          )}
        </button>
      </div>
    </div>
  );
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0]!;
}

function calculateStreak(entries: HabitEntry[]): number {
  if (entries.length === 0) return 0;

  const sortedDates = entries
    .map((e) => e.date.split("T")[0]!)
    .sort()
    .reverse();

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < sortedDates.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];

    if (sortedDates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
