import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, Target } from "lucide-react";
import { Button, EmptyState } from "@stageholder/ui";
import { useHabits } from "@/lib/api/habits";
import { HabitCard } from "@/components/habits/habit-card";
import { CreateHabitDialog } from "@/components/habits/create-habit-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import type { Habit } from "@repo/core/types";

export const Route = createFileRoute("/_app/habits/")({
  component: HabitsPage,
});

function HabitsPage() {
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
        <Button
          icon={<Plus size={16} />}
          onPress={() => setShowCreateDialog(true)}
        >
          New Habit
        </Button>
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
        <EmptyState>
          <EmptyState.IconSlot>
            <Target className="size-5 text-muted-foreground" />
          </EmptyState.IconSlot>
          <EmptyState.Title>No habits yet</EmptyState.Title>
          <EmptyState.Description>
            Create one to start tracking your progress.
          </EmptyState.Description>
        </EmptyState>
      )}

      <CreateHabitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
