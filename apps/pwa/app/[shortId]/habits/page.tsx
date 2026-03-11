"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useHabits } from "@/lib/api/habits";
import { HabitCard } from "@/components/habits/habit-card";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import type { Habit } from "@repo/core/types";

export default function HabitsPage() {
  const { data: habits, isLoading } = useHabits();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const isViewingToday = selectedDate === todayStr;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Habits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your daily habits and build streaks.
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New Habit
        </button>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-3">
        <DatePicker
          value={selectedDate}
          onChange={(v) => setSelectedDate(v || todayStr)}
          placeholder="Select date"
          clearable={false}
          maxDate={new Date()}
          className="w-auto"
        />
        {!isViewingToday && (
          <button
            onClick={() => setSelectedDate(todayStr)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Back to today
          </button>
        )}
        {!isViewingToday && (
          <span className="text-xs text-muted-foreground">
            Viewing:{" "}
            {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMM d, yyyy")}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
              </div>
              <div className="mt-3 flex justify-between">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <div className="h-2.5 w-2.5 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-muted" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-7 w-16 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : habits && habits.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {habits.map((habit: Habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              selectedDate={isViewingToday ? undefined : selectedDate}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No habits yet. Create one to start tracking your progress.
          </p>
        </div>
      )}

      <CreateHabitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
