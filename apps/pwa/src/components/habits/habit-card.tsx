import { useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Check, MoreHorizontal, SkipForward, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HabitProgress } from "./habit-progress";
import { EditHabitSheet } from "./edit-habit-sheet";
import { RadianceBurst } from "./radiance-burst";
import {
  useCreateHabitEntry,
  useUpdateHabitEntry,
  useSkipHabitEntry,
  useHabitEntries,
  useDeleteHabit,
} from "@/lib/api/habits";
import { toast } from "sonner";
import type { Habit, HabitEntry } from "@repo/core/types";
import {
  resolveTargetCount,
  entryCompletionRatio,
} from "@/lib/habits/entry-resolution";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  IconButton,
  XStack,
} from "@stageholder/ui";

interface HabitCardProps {
  habit: Habit;
  /** When set, the card shows status for this date instead of today */
  selectedDate?: string;
}

export function HabitCard({ habit, selectedDate }: HabitCardProps) {
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
    (e: HabitEntry) => e.date.split("T")[0] === activeDate,
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  const isSkipped = activeDateEntry?.type === "skip";
  const activeTargetCount = activeDateEntry
    ? resolveTargetCount(activeDateEntry, habit)
    : habit.targetCount;
  const isComplete = !isSkipped && activeDateValue >= activeTargetCount;
  const activeDateObj = selectedDate
    ? new Date(selectedDate + "T00:00:00")
    : new Date();
  const activeDow = activeDateObj.getDay();
  const isScheduledOnActiveDate =
    !habit.scheduledDays ||
    habit.scheduledDays.length === 0 ||
    habit.scheduledDays.includes(activeDow);
  const streak = calculateStreak(entries || [], habit);

  // Week dots data
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entries?.find(
      (e: HabitEntry) => e.date.split("T")[0] === dateStr,
    );
    const dow = date.getDay();
    const isScheduled =
      !habit.scheduledDays ||
      habit.scheduledDays.length === 0 ||
      habit.scheduledDays.includes(dow);
    const effectiveTarget = entry
      ? resolveTargetCount(entry, habit)
      : habit.targetCount;
    return {
      label: format(date, "EEEEE"),
      dateStr,
      value: entry?.value ?? 0,
      type: entry?.type as "completion" | "skip" | "fail" | undefined,
      isToday: dateStr === today,
      isScheduled,
      effectiveTarget,
    };
  });

  function handleCheckIn() {
    if (isComplete || !isScheduledOnActiveDate) return;

    const dateLabel = isViewingToday
      ? habit.name
      : `${habit.name} (${activeDate})`;
    const onSuccess = () => {
      toast.success(`Checked in for ${dateLabel}`);
      setBouncing(true);
      setTimeout(() => setBouncing(false), 500);
      if (activeDateValue + 1 >= habit.targetCount) {
        setCompleting(true);
        setTimeout(() => setCompleting(false), 1200);
      }
    };

    if (!activeDateEntry) {
      createEntry.mutate(
        { habitId: habit.id, data: { date: activeDate, value: 1 } },
        { onSuccess, onError: () => toast.error("Failed to check in") },
      );
      return;
    }

    // An entry exists. If it's a skip or fail (value=0), promote it to a
    // completion in one PATCH — the API zeros skipReason and stamps type
    // for us. For an in-progress completion, increment value.
    const isNonCompletion =
      activeDateEntry.type === "skip" || activeDateEntry.type === "fail";
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: isNonCompletion
          ? { type: "completion", value: 1 }
          : { value: activeDateValue + 1 },
      },
      { onSuccess, onError: () => toast.error("Failed to check in") },
    );
  }

  function handleSkip() {
    if (isComplete || isSkipped || !isScheduledOnActiveDate || activeDateEntry)
      return;
    skipEntry.mutate(
      { habitId: habit.id, data: { date: activeDate } },
      {
        onSuccess: () => toast.success(`Skipped ${habit.name}`),
        onError: () => toast.error("Failed to skip"),
      },
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
      },
    );
  }

  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    deleteHabit.mutate(habit.id, {
      onSuccess: () => toast.success(`"${habit.name}" deleted`),
      onError: () => toast.error("Failed to delete habit"),
    });
    setDeleteOpen(false);
  }

  const isPending =
    createEntry.isPending || updateEntry.isPending || skipEntry.isPending;
  const habitColor = habit.color || "#3b82f6";

  return (
    <>
      <div
        className={cn(
          "relative rounded-xl border border-border bg-card p-5 transition-all",
          completing && "habit-card-completing",
        )}
      >
        <RadianceBurst active={completing} color={habitColor} />
        <div className="flex items-start justify-between">
          <Link
            to="/habits/$id"
            params={{ id: habit.id }}
            className="flex items-center gap-3 hover:opacity-80"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
              style={{ backgroundColor: habitColor + "20" }}
            >
              {habit.icon || habit.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {habit.name}
              </h3>
              {habit.description && (
                <p className="text-xs text-muted-foreground">
                  {habit.description}
                </p>
              )}
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="ghost" size="sm" aria-label="Habit options">
                <MoreHorizontal className="size-4" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onPress={() => setEditOpen(true)}>
                <DropdownMenu.Label>Edit</DropdownMenu.Label>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                intent="danger"
                onPress={() => setDeleteOpen(true)}
              >
                <DropdownMenu.Label>Delete</DropdownMenu.Label>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>

        <div className="mt-4">
          <HabitProgress
            value={activeDateValue}
            targetCount={activeTargetCount}
            color={habit.color}
            streak={streak}
          />
        </div>

        {/* Week dots */}
        <div className="mt-3 flex justify-between px-1">
          {weekDays.map((day) => {
            const ratio =
              day.effectiveTarget > 0 ? day.value / day.effectiveTarget : 0;
            const isDaySkipped = day.type === "skip";
            const isDayFailed = day.type === "fail";
            return (
              <div
                key={day.dateStr}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "text-[10px]",
                    day.isScheduled
                      ? "text-muted-foreground"
                      : "text-muted-foreground/40",
                  )}
                >
                  {day.label}
                </span>
                {isDayFailed ? (
                  <div
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive/80",
                      day.isToday &&
                        "ring-1 ring-offset-1 ring-offset-background",
                    )}
                    title="Failed"
                  >
                    <span className="text-[8px] leading-none text-destructive-foreground">
                      ✕
                    </span>
                  </div>
                ) : isDaySkipped ? (
                  <div
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40",
                      day.isToday &&
                        "ring-1 ring-offset-1 ring-offset-background",
                    )}
                    title="Skipped"
                  >
                    <span className="text-[8px] leading-none text-muted-foreground">
                      —
                    </span>
                  </div>
                ) : ratio >= 1 ? (
                  <span
                    className="text-sm leading-none"
                    title={`${day.value}/${day.effectiveTarget}`}
                  >
                    🔥
                  </span>
                ) : (
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border transition-all",
                      day.isToday &&
                        "ring-1 ring-offset-1 ring-offset-background",
                      !day.isScheduled
                        ? "border-dashed border-muted-foreground/20"
                        : ratio > 0
                          ? "border-transparent"
                          : "border-muted-foreground/30",
                    )}
                    style={
                      !day.isScheduled
                        ? undefined
                        : ratio > 0
                          ? {
                              backgroundColor: habitColor + "60",
                              borderColor: habitColor + "60",
                            }
                          : undefined
                    }
                  />
                )}
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
              <IconButton
                variant="outline"
                size="sm"
                onPress={handleUndo}
                disabled={isPending}
                title="Undo last check-in"
                aria-label="Undo last check-in"
              >
                <Undo2 className="size-3" />
              </IconButton>
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
            ) : isComplete ? (
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition-transform dark:bg-green-900/30 dark:text-green-400",
                  bouncing && "scale-110",
                )}
              >
                <Check className="size-3.5" />
                Complete
              </span>
            ) : (
              <>
                {!activeDateEntry && isScheduledOnActiveDate && (
                  <Button
                    intent="outline"
                    size="sm"
                    icon={<SkipForward className="size-3" />}
                    onPress={handleSkip}
                    disabled={isPending}
                    title="Skip today"
                  >
                    Skip
                  </Button>
                )}
                <Button
                  size="sm"
                  onPress={handleCheckIn}
                  disabled={isPending}
                  loading={isPending}
                  loadingText="Checking…"
                  className={cn(
                    "transition-transform",
                    bouncing && "scale-110",
                  )}
                >
                  {habit.targetCount > 1
                    ? `${activeDateValue}/${habit.targetCount}`
                    : "Check In"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <EditHabitSheet
        habit={habit}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Destructive confirm — replaces the previous window.confirm() so the
          modal lives inside meridian's design language. */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        disableRemoveScroll
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay />
          <AlertDialog.Content>
            <AlertDialog.Title>
              Delete &ldquo;{habit.name}&rdquo;?
            </AlertDialog.Title>
            <AlertDialog.Description>
              This cannot be undone. All check-ins for this habit will be
              permanently removed.
            </AlertDialog.Description>
            <XStack gap="$2" justify="flex-end" mt="$4">
              <AlertDialog.Cancel asChild>
                <Button intent="outline">Cancel</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button intent="destructive" onPress={confirmDelete}>
                  Delete
                </Button>
              </AlertDialog.Action>
            </XStack>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog>
    </>
  );
}

function calculateStreak(
  entries: HabitEntry[],
  habit: Pick<Habit, "targetCount" | "scheduledDays">,
): number {
  if (entries.length === 0) return 0;

  const entryMap = new Map<
    string,
    { value: number; type?: string; targetCountSnapshot?: number }
  >();
  for (const e of entries) {
    const dateStr = e.date.split("T")[0]!;
    const existing = entryMap.get(dateStr);
    entryMap.set(dateStr, {
      value: (existing?.value ?? 0) + e.value,
      type: e.type || existing?.type || "completion",
      targetCountSnapshot:
        existing?.targetCountSnapshot ?? e.targetCountSnapshot,
    });
  }

  const hasSchedule = habit.scheduledDays && habit.scheduledDays.length > 0;
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // If today is scheduled and completed, count it
  const todayDow = today.getDay();
  const todayIsScheduled =
    !hasSchedule || habit.scheduledDays!.includes(todayDow);
  const todayEntry = entryMap.get(todayStr);
  const todayIsSkipped = todayEntry?.type === "skip";
  const todayTarget = resolveTargetCount(
    { targetCountSnapshot: todayEntry?.targetCountSnapshot },
    habit,
  );
  const todayCompleted =
    todayIsScheduled &&
    !todayIsSkipped &&
    (todayEntry?.value ?? 0) >= todayTarget;
  // Skipped today: don't break streak but don't count it either
  let streak = todayCompleted ? 1 : 0;

  for (let i = 1; i <= 90; i++) {
    const checkDay = subDays(today, i);
    const dow = checkDay.getDay();

    // Skip non-scheduled days
    if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;

    const checkDate = format(checkDay, "yyyy-MM-dd");
    const dayEntry = entryMap.get(checkDate);

    // Skipped day: preserve streak but don't increment
    if (dayEntry?.type === "skip") continue;
    // Failed day: user explicitly marked this date as a miss — chain breaks.
    if (dayEntry?.type === "fail") break;

    const dayValue = dayEntry?.value ?? 0;
    const dayTarget = resolveTargetCount(
      { targetCountSnapshot: dayEntry?.targetCountSnapshot },
      habit,
    );
    if (dayValue >= dayTarget) {
      streak++;
    } else {
      // If today wasn't completed and this is the first scheduled day back, don't break yet
      if (i === 1 && !todayCompleted && !todayIsScheduled) continue;
      break;
    }
  }

  return streak;
}
