"use client";

import { useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import Link from "next/link";
import { MoreHorizontal, SkipForward, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HabitProgress } from "./habit-progress";
import { EditHabitSheet } from "./edit-habit-sheet";
import {
  useCreateHabitEntry,
  useUpdateHabitEntry,
  useSkipHabitEntry,
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
  /** When set, the card shows status for this date instead of today */
  selectedDate?: string;
}

export function HabitCard({ habit, selectedDate }: HabitCardProps) {
  const { workspace } = useWorkspace();
  const today = format(new Date(), "yyyy-MM-dd");
  const activeDate = selectedDate || today;
  const isViewingToday = !selectedDate || selectedDate === today;
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const { data: entries } = useHabitEntries(habit.id, {
    startDate: ninetyDaysAgo,
    endDate: today,
  });

  const createEntry = useCreateHabitEntry();
  const updateEntry = useUpdateHabitEntry();
  const skipEntry = useSkipHabitEntry();
  const deleteHabit = useDeleteHabit();
  const [editOpen, setEditOpen] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const activeDateEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === activeDate
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  const isSkipped = activeDateEntry?.type === "skip";
  const isComplete = !isSkipped && activeDateValue >= habit.targetCount;
  const activeDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
  const activeDow = activeDateObj.getDay();
  const isScheduledOnActiveDate = !habit.scheduledDays || habit.scheduledDays.length === 0 || habit.scheduledDays.includes(activeDow);
  const streak = calculateStreak(entries || [], habit.targetCount, habit.scheduledDays);

  // Week dots data
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entries?.find((e: HabitEntry) => e.date.split("T")[0] === dateStr);
    const dow = date.getDay();
    const isScheduled = !habit.scheduledDays || habit.scheduledDays.length === 0 || habit.scheduledDays.includes(dow);
    return {
      label: format(date, "EEEEE"),
      dateStr,
      value: entry?.value ?? 0,
      type: entry?.type as "completion" | "skip" | undefined,
      isToday: dateStr === today,
      isScheduled,
    };
  });

  function handleCheckIn() {
    if (isComplete || isSkipped || !isScheduledOnActiveDate) return;

    const dateLabel = isViewingToday ? habit.name : `${habit.name} (${activeDate})`;
    const onSuccess = () => {
      toast.success(`Checked in for ${dateLabel}`);
      setBouncing(true);
      setTimeout(() => setBouncing(false), 500);
      if (activeDateValue + 1 >= habit.targetCount) {
        setCompleting(true);
        setTimeout(() => setCompleting(false), 1000);
      }
    };

    if (!activeDateEntry) {
      createEntry.mutate(
        { habitId: habit.id, data: { date: activeDate, value: 1 } },
        { onSuccess, onError: () => toast.error("Failed to check in") }
      );
    } else {
      updateEntry.mutate(
        {
          habitId: habit.id,
          entryId: activeDateEntry.id,
          data: { value: activeDateValue + 1 },
        },
        { onSuccess, onError: () => toast.error("Failed to check in") }
      );
    }
  }

  function handleSkip() {
    if (isComplete || isSkipped || !isScheduledOnActiveDate || activeDateEntry) return;
    skipEntry.mutate(
      { habitId: habit.id, data: { date: activeDate } },
      {
        onSuccess: () => toast.success(`Skipped ${habit.name}`),
        onError: () => toast.error("Failed to skip"),
      }
    );
  }

  function handleUndo() {
    if (!activeDateEntry || activeDateValue <= 0) return;

    const newValue = activeDateValue - 1;
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: activeDateEntry.id,
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

  const isPending = createEntry.isPending || updateEntry.isPending || skipEntry.isPending;
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
              <button className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Habit options">
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
            value={activeDateValue}
            targetCount={habit.targetCount}
            color={habit.color}
            streak={streak}
          />
        </div>

        {/* Week dots */}
        <div className="mt-3 flex justify-between px-1">
          {weekDays.map((day) => {
            const ratio = habit.targetCount > 0 ? day.value / habit.targetCount : 0;
            const isDaySkipped = day.type === "skip";
            return (
              <div key={day.dateStr} className="flex flex-col items-center gap-1">
                <span className={cn("text-[10px]", day.isScheduled ? "text-muted-foreground" : "text-muted-foreground/40")}>{day.label}</span>
                {isDaySkipped ? (
                  <div
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40",
                      day.isToday && "ring-1 ring-offset-1 ring-offset-background"
                    )}
                    title="Skipped"
                  >
                    <span className="text-[8px] leading-none text-muted-foreground">—</span>
                  </div>
                ) : ratio >= 1 ? (
                  <span className="text-sm leading-none" title={`${day.value}/${habit.targetCount}`}>🔥</span>
                ) : (
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded-full border transition-all",
                    day.isToday && "ring-1 ring-offset-1 ring-offset-background",
                    !day.isScheduled
                      ? "border-dashed border-muted-foreground/20"
                      : ratio > 0
                          ? "border-transparent"
                          : "border-muted-foreground/30"
                  )}
                  style={
                    !day.isScheduled
                      ? undefined
                      : ratio > 0
                          ? { backgroundColor: habitColor + "60", borderColor: habitColor + "60" }
                          : undefined
                  }
                />)}
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
            {activeDateValue > 0 && !isSkipped && (
              <button
                onClick={handleUndo}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-foreground disabled:opacity-50"
                title="Undo last check-in"
              >
                <Undo2 className="size-3" />
              </button>
            )}
            {isSkipped ? (
              <span className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <SkipForward className="size-3" />
                Skipped
              </span>
            ) : !isScheduledOnActiveDate && !isComplete ? (
              <span className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Rest day
              </span>
            ) : (
            <>
              {!isComplete && !activeDateEntry && isScheduledOnActiveDate && (
                <button
                  onClick={handleSkip}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-foreground disabled:opacity-50"
                  title="Skip today"
                >
                  <SkipForward className="size-3" />
                  Skip
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
                  `${activeDateValue}/${habit.targetCount}`
                ) : (
                  "Check In"
                )}
              </button>
            </>
            )}
          </div>
        </div>
      </div>

      <EditHabitSheet habit={habit} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function calculateStreak(
  entries: HabitEntry[],
  targetCount: number,
  scheduledDays?: number[]
): number {
  if (entries.length === 0) return 0;

  const entryMap = new Map<string, { value: number; type?: string }>();
  for (const e of entries) {
    const dateStr = e.date.split("T")[0]!;
    const existing = entryMap.get(dateStr);
    entryMap.set(dateStr, {
      value: (existing?.value ?? 0) + e.value,
      type: e.type || existing?.type || "completion",
    });
  }

  const hasSchedule = scheduledDays && scheduledDays.length > 0;
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // If today is scheduled and completed, count it
  const todayDow = today.getDay();
  const todayIsScheduled = !hasSchedule || scheduledDays!.includes(todayDow);
  const todayEntry = entryMap.get(todayStr);
  const todayIsSkipped = todayEntry?.type === "skip";
  const todayCompleted = todayIsScheduled && !todayIsSkipped && (todayEntry?.value ?? 0) >= targetCount;
  // Skipped today: don't break streak but don't count it either
  let streak = todayCompleted ? 1 : 0;

  for (let i = 1; i <= 90; i++) {
    const checkDay = subDays(today, i);
    const dow = checkDay.getDay();

    // Skip non-scheduled days
    if (hasSchedule && !scheduledDays!.includes(dow)) continue;

    const checkDate = format(checkDay, "yyyy-MM-dd");
    const dayEntry = entryMap.get(checkDate);

    // Skipped day: preserve streak but don't increment
    if (dayEntry?.type === "skip") continue;

    const dayValue = dayEntry?.value ?? 0;
    if (dayValue >= targetCount) {
      streak++;
    } else {
      // If today wasn't completed and this is the first scheduled day back, don't break yet
      if (i === 1 && !todayCompleted && !todayIsScheduled) continue;
      break;
    }
  }

  return streak;
}
