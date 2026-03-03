"use client";

import { useState } from "react";
import { useHabits } from "@/lib/api/habits";
import { HabitCard } from "@/components/habits/habit-card";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import type { Habit } from "@repo/core/types";

export default function HabitsPage() {
  const { data: habits, isLoading } = useHabits();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="space-y-6">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New Habit
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading habits...</div>
      ) : habits && habits.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {habits.map((habit: Habit) => (
            <HabitCard key={habit.id} habit={habit} />
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
