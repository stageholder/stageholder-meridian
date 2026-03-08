"use client";

import { useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import Link from "next/link";
import { MoreHorizontal, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HabitProgress } from "./habit-progress";
import { EditHabitSheet } from "./edit-habit-sheet";
import {
  useCreateHabitEntry,
  useUpdateHabitEntry,
  useHabitEntries,
  useDeleteHabit,
} from "@/lib/api/habits";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import type { Habit, HabitEntry } from "@repo/core/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HabitCardProps {
  habit: Habit;
}

export function HabitCard({ habit }: HabitCardProps) {
  const { workspace } = useWorkspace();
  const today = format(new Date(), "yyyy-MM-dd");
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const { data: entries } = useHabitEntries(habit.id, {
    startDate: ninetyDaysAgo,
    endDate: today,
  });

  const createEntry = useCreateHabitEntry();
  const updateEntry = useUpdateHabitEntry();
  const deleteHabit = useDeleteHabit();
  const [editOpen, setEditOpen] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const todayEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === today
  );
  const todayValue = todayEntry?.value ?? 0;
  const isComplete = todayValue >= habit.targetCount;
  const streak = calculateStreak(entries || [], habit.targetCount);

  // Week dots data
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entries?.find((e: HabitEntry) => e.date.split("T")[0] === dateStr);
    return {
      label: format(date, "EEEEE"),
      dateStr,
      value: entry?.value ?? 0,
      isToday: dateStr === today,
    };
  });

  function handleCheckIn() {
    if (isComplete) return;

    const onSuccess = () => {
      toast.success(`Checked in for ${habit.name}`);
      setBouncing(true);
      setTimeout(() => setBouncing(false), 500);
      if (todayValue + 1 >= habit.targetCount) {
        setCompleting(true);
        setTimeout(() => setCompleting(false), 1000);
      }
    };

    if (!todayEntry) {
      createEntry.mutate(
        { habitId: habit.id, data: { date: today, value: 1 } },
        { onSuccess, onError: () => toast.error("Failed to check in") }
      );
    } else {
      updateEntry.mutate(
        {
          habitId: habit.id,
          entryId: todayEntry.id,
          data: { value: todayValue + 1 },
        },
        { onSuccess, onError: () => toast.error("Failed to check in") }
      );
    }
  }

  function handleUndo() {
    if (!todayEntry || todayValue <= 0) return;

    const newValue = todayValue - 1;
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: todayEntry.id,
        data: { value: newValue },
      },
      {
        onSuccess: () => toast.success(`Undid check-in for ${habit.name}`),
        onError: () => toast.error("Failed to undo"),
      }
    );
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${habit.name}"? This cannot be undone.`)) return;

    deleteHabit.mutate(habit.id, {
      onSuccess: () => toast.success(`"${habit.name}" deleted`),
      onError: () => toast.error("Failed to delete habit"),
    });
  }

  const isPending = createEntry.isPending || updateEntry.isPending;
  const habitColor = habit.color || "#3b82f6";

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-border bg-card p-5 transition-all",
          completing && "ring-2 ring-green-500/20"
        )}
        style={completing ? { backgroundColor: habitColor + "08" } : undefined}
      >
        <div className="flex items-start justify-between">
          <Link
            href={`/${workspace.shortId}/habits/${habit.id}`}
            className="flex items-center gap-3 hover:opacity-80"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
              style={{ backgroundColor: habitColor + "20" }}
            >
              {habit.icon || habit.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{habit.name}</h3>
              {habit.description && (
                <p className="text-xs text-muted-foreground">{habit.description}</p>
              )}
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4">
          <HabitProgress
            value={todayValue}
            targetCount={habit.targetCount}
            color={habit.color}
            streak={streak}
          />
        </div>

        {/* Week dots */}
        <div className="mt-3 flex justify-between px-1">
          {weekDays.map((day) => {
            const ratio = habit.targetCount > 0 ? day.value / habit.targetCount : 0;
            return (
              <div key={day.dateStr} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{day.label}</span>
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded-full border transition-all",
                    day.isToday && "ring-1 ring-offset-1 ring-offset-background",
                    ratio >= 1
                      ? "border-transparent"
                      : ratio > 0
                        ? "border-transparent"
                        : "border-muted-foreground/30"
                  )}
                  style={
                    ratio >= 1
                      ? { backgroundColor: habitColor, borderColor: habitColor }
                      : ratio > 0
                        ? { backgroundColor: habitColor + "60", borderColor: habitColor + "60" }
                        : undefined
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {habit.unit
              ? `${habit.targetCount} ${habit.unit}`
              : `${habit.targetCount}x target`}
          </span>
          <div className="flex items-center gap-1.5">
            {todayValue > 0 && (
              <button
                onClick={handleUndo}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-foreground disabled:opacity-50"
                title="Undo last check-in"
              >
                <Undo2 className="size-3" />
              </button>
            )}
            <button
              onClick={handleCheckIn}
              disabled={isComplete || isPending}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                bouncing && "animate-bounce",
                isComplete
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              )}
            >
              {isComplete ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Complete
                </>
              ) : isPending ? (
                "Checking..."
              ) : habit.targetCount > 1 ? (
                `${todayValue}/${habit.targetCount}`
              ) : (
                "Check In"
              )}
            </button>
          </div>
        </div>
      </div>

      <EditHabitSheet habit={habit} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function calculateStreak(entries: HabitEntry[], targetCount: number): number {
  if (entries.length === 0) return 0;

  const entryMap = new Map<string, number>();
  for (const e of entries) {
    const dateStr = e.date.split("T")[0]!;
    entryMap.set(dateStr, (entryMap.get(dateStr) ?? 0) + e.value);
  }

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // If today is not yet completed, start counting from yesterday
  const todayCompleted = (entryMap.get(todayStr) ?? 0) >= targetCount;
  let streak = todayCompleted ? 1 : 0;
  const startOffset = todayCompleted ? 1 : 1;

  for (let i = startOffset; i <= 90; i++) {
    const checkDate = format(subDays(today, i), "yyyy-MM-dd");
    const dayValue = entryMap.get(checkDate) ?? 0;
    if (dayValue >= targetCount) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
