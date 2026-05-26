import { useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Check, MoreHorizontal, SkipForward, Undo2, X } from "lucide-react";
import { EditHabitSheet } from "./edit-habit-sheet";
import { RadianceBurst } from "./radiance-burst";
import {
  useCreateHabitEntry,
  useUpdateHabitEntry,
  useSkipHabitEntry,
  useFailHabitEntry,
  useHabitEntries,
  useDeleteHabit,
} from "@/lib/api/habits";
import { toast } from "sonner";
import type { Habit, HabitEntry } from "@repo/core/types";
import {
  resolveTargetCount,
  calculateWeeklyStreak,
  weeklyCompletions,
} from "@/lib/habits/entry-resolution";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  H3,
  IconButton,
  StreakBadge,
  Text,
  View,
  XStack,
  YStack,
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
  const failEntry = useFailHabitEntry();
  const deleteHabit = useDeleteHabit();
  const [editOpen, setEditOpen] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const isQuota = habit.frequency === "weekly_target";

  const activeDateEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === activeDate,
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  const isSkipped = activeDateEntry?.type === "skip";
  const isFailed = activeDateEntry?.type === "fail";
  const activeTargetCount = activeDateEntry
    ? resolveTargetCount(activeDateEntry, habit)
    : habit.targetCount;
  const isComplete = !isSkipped && activeDateValue >= activeTargetCount;
  const activeDateObj = selectedDate
    ? new Date(selectedDate + "T00:00:00")
    : new Date();
  const activeDow = activeDateObj.getDay();
  // Quota habits are loggable on ANY day, so treat them as always scheduled.
  const isScheduledOnActiveDate =
    isQuota ||
    !habit.scheduledDays ||
    habit.scheduledDays.length === 0 ||
    habit.scheduledDays.includes(activeDow);

  // Aggregate entries per day for the weekly-quota streak / progress.
  const entryMap = new Map<
    string,
    { value: number; type?: string; targetCountSnapshot?: number }
  >();
  for (const e of entries || []) {
    const dateStr = e.date.split("T")[0]!;
    const existing = entryMap.get(dateStr);
    entryMap.set(dateStr, {
      value: (existing?.value ?? 0) + e.value,
      type: e.type || existing?.type || "completion",
      targetCountSnapshot:
        existing?.targetCountSnapshot ?? e.targetCountSnapshot,
    });
  }

  const streak = isQuota
    ? calculateWeeklyStreak(entryMap, habit)
    : calculateStreak(entries || [], habit);
  const weeklyProgress = isQuota
    ? weeklyCompletions(
        entryMap,
        startOfWeek(new Date(), { weekStartsOn: 1 }),
        habit,
      )
    : 0;

  // Week dots data
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entries?.find(
      (e: HabitEntry) => e.date.split("T")[0] === dateStr,
    );
    const dow = date.getDay();
    // Quota habits have no rest days — every day is schedulable/loggable.
    const isScheduled =
      isQuota ||
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
    if (isComplete || isSkipped || !isScheduledOnActiveDate) return;
    const onSuccess = () => toast.success(`Skipped ${habit.name}`);
    const onError = () => toast.error("Failed to skip");
    if (!activeDateEntry) {
      skipEntry.mutate(
        { habitId: habit.id, data: { date: activeDate } },
        { onSuccess, onError },
      );
      return;
    }
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: { type: "skip", value: 0 },
      },
      { onSuccess, onError },
    );
  }

  // Mark today failed — breaks the streak.
  function handleFail() {
    if (isComplete || isFailed || !isScheduledOnActiveDate) return;
    const onSuccess = () => toast.success(`Marked ${habit.name} failed`);
    const onError = () => toast.error("Failed to update");
    if (!activeDateEntry) {
      failEntry.mutate(
        { habitId: habit.id, data: { date: activeDate } },
        { onSuccess, onError },
      );
      return;
    }
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: { type: "fail", value: 0 },
      },
      { onSuccess, onError },
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

  // Clear a skip/fail back to an un-acted day (value-0 completion).
  function handleClearStatus() {
    if (!activeDateEntry) return;
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: activeDateEntry.id,
        data: { type: "completion", value: 0 },
      },
      {
        onSuccess: () => toast.success(`Cleared ${habit.name}`),
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
    createEntry.isPending ||
    updateEntry.isPending ||
    skipEntry.isPending ||
    failEntry.isPending;
  // Orange = the habit category identity color (matches the calendar + detail
  // pages). The whole habit surface reads as orange, not the per-habit blue.
  const habitColor = "var(--ring-habit)";
  const habitTrack = "var(--ring-habit-track)";

  return (
    <>
      <View
        position="relative"
        rounded="$5"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        p="$4"
        gap="$3"
        transition="medium"
        // allowlist: habit-card-completing — bespoke completion keyframe (no token equivalent)
        className={completing ? "habit-card-completing" : undefined}
      >
        <RadianceBurst active={completing} />

        {/* Header — icon · name/desc · streak · menu */}
        <XStack items="center" gap="$2.5">
          {/* Keep <Link> for routing (prefetch + middle-click); style lives on
              the inner XStack so the kit tokens/hover apply. */}
          <Link
            to="/habits/$id"
            params={{ id: habit.id }}
            style={{ textDecoration: "none", flex: 1, minWidth: 0 }}
          >
            <XStack
              items="center"
              gap="$2.5"
              minW={0}
              transition="quick"
              hoverStyle={{ opacity: 0.8 }}
            >
              {/* Icon badge tinted with the habit identity color (faint orange) */}
              <View
                height={40}
                width={40}
                shrink={0}
                items="center"
                justify="center"
                rounded="$lg"
                style={{ backgroundColor: habitTrack }}
              >
                <Text fontSize="$6">
                  {habit.icon || habit.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              {/* justify="center" + tight line-heights keep the name/desc block
                  vertically centered against the icon, with or without a desc. */}
              <YStack flex={1} minW={0} justify="center">
                <H3
                  fontSize="$3"
                  fontWeight="600"
                  color="$color"
                  numberOfLines={1}
                  lineHeight={20}
                >
                  {habit.name}
                </H3>
                {habit.description ? (
                  <Text
                    fontSize="$1"
                    color="$mutedForeground"
                    numberOfLines={1}
                    lineHeight={16}
                  >
                    {habit.description}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
          </Link>
          {streak > 0 ? <StreakBadge count={streak} size="$2" /> : null}
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="ghost" size="sm" aria-label="Habit options">
                <MoreHorizontal size={16} />
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
        </XStack>

        {/* Spacer pins the week strip + actions to the bottom, so cards stay
            aligned whether or not they carry a description. */}
        <View flex={1} />

        {/* Week strip — a run of filled days reads as the streak at a glance */}
        <XStack justify="space-between" px="$0.5">
          {weekDays.map((day) => {
            const ratio =
              day.effectiveTarget > 0 ? day.value / day.effectiveTarget : 0;
            const isDaySkipped = day.type === "skip";
            const isDayFailed = day.type === "fail";
            const isPast = day.dateStr < today;
            const complete = !isDaySkipped && !isDayFailed && ratio >= 1;
            // Auto-fail only days with NO entry (truly missed). A cleared day
            // (value-0 completion entry) stays neutral, so "undo fail" works.
            // Quota habits NEVER auto-fail — a missed day just isn't a
            // completion toward the weekly target.
            const failed =
              !isQuota &&
              (isDayFailed ||
                (day.isScheduled && isPast && day.type === undefined));
            const partial = !isDaySkipped && !failed && ratio > 0 && ratio < 1;
            return (
              <YStack key={day.dateStr} items="center" gap="$1.5">
                <Text
                  fontSize={9}
                  fontWeight="500"
                  color="$mutedForeground"
                  opacity={day.isScheduled ? 0.8 : 0.35}
                >
                  {day.label}
                </Text>
                {/* One consistent dot per day: filled (habit color) = done,
                    tinted = partial, dashed = skip/rest, red ring = fail,
                    primary ring = today. A run of filled dots IS the streak. */}
                <View
                  width={11}
                  height={11}
                  rounded={9999}
                  transition="quick"
                  title={
                    failed
                      ? "Failed"
                      : isDaySkipped
                        ? "Skipped"
                        : `${day.value}/${day.effectiveTarget}`
                  }
                  borderWidth={complete ? 0 : 1}
                  borderStyle={
                    !day.isScheduled || isDaySkipped ? "dashed" : "solid"
                  }
                  borderColor={failed ? "$destructive" : "$mutedForeground"}
                  opacity={
                    !day.isScheduled
                      ? 0.3
                      : complete || partial || failed
                        ? 1
                        : 0.4
                  }
                  outlineWidth={day.isToday ? 2 : 0}
                  outlineColor="$primary"
                  outlineStyle="solid"
                  outlineOffset={1}
                  style={
                    complete
                      ? { backgroundColor: habitColor }
                      : partial
                        ? { backgroundColor: habitTrack }
                        : undefined
                  }
                />
              </YStack>
            );
          })}
        </XStack>

        {/* Action row — primary (Check In) or status on the left,
            representative icon actions on the right. */}
        {isQuota ? (
          /* Quota footer: log-only. LEFT = "Logged" badge when today is done,
             else the Check In button. RIGHT = "{progress}/{target} this week"
             + an Undo when today is logged. No Skip / Fail for quota. */
          <XStack items="center" justify="space-between" gap="$2">
            {isComplete ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$successMuted"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                <Text color="$success" lineHeight={0}>
                  <Check size={14} />
                </Text>
                <Text fontSize="$1" fontWeight="600" color="$success">
                  Logged
                </Text>
              </XStack>
            ) : (
              <Button
                size="sm"
                borderWidth={0}
                color={"#ffffff" as never}
                icon={<Check size={14} color="#ffffff" />}
                style={{ backgroundColor: "var(--ring-habit)" }}
                hoverStyle={
                  {
                    backgroundColor: "var(--ring-habit)",
                    opacity: 0.9,
                  } as never
                }
                pressStyle={
                  {
                    backgroundColor: "var(--ring-habit)",
                    opacity: 0.82,
                  } as never
                }
                onPress={handleCheckIn}
                disabled={isPending}
                loading={isPending}
                loadingText="Logging…"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                Check In
              </Button>
            )}

            <XStack items="center" gap="$1.5">
              <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                {weeklyProgress}/{habit.weeklyTarget} this week
              </Text>
              {isComplete && (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleUndo}
                  disabled={isPending}
                  title="Undo today's log"
                  aria-label="Undo today's log"
                >
                  <Undo2 size={14} />
                </IconButton>
              )}
            </XStack>
          </XStack>
        ) : (
          <XStack items="center" justify="space-between" gap="$2">
            {isComplete ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$successMuted"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                <Text color="$success" lineHeight={0}>
                  <Check size={14} />
                </Text>
                <Text fontSize="$1" fontWeight="600" color="$success">
                  Complete
                </Text>
              </XStack>
            ) : isSkipped ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$muted"
              >
                <Text color="$mutedForeground" lineHeight={0}>
                  <SkipForward size={12} />
                </Text>
                <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
                  Skipped
                </Text>
              </XStack>
            ) : isFailed ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$destructiveMuted"
              >
                <Text color="$destructive" lineHeight={0}>
                  <X size={12} />
                </Text>
                <Text fontSize="$1" fontWeight="600" color="$destructive">
                  Failed
                </Text>
              </XStack>
            ) : !isScheduledOnActiveDate ? (
              <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                Rest day
              </Text>
            ) : (
              <Button
                size="sm"
                borderWidth={0}
                color={"#ffffff" as never}
                icon={<Check size={14} color="#ffffff" />}
                style={{ backgroundColor: "var(--ring-habit)" }}
                hoverStyle={
                  {
                    backgroundColor: "var(--ring-habit)",
                    opacity: 0.9,
                  } as never
                }
                pressStyle={
                  {
                    backgroundColor: "var(--ring-habit)",
                    opacity: 0.82,
                  } as never
                }
                onPress={handleCheckIn}
                disabled={isPending}
                loading={isPending}
                loadingText="Checking…"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                {activeDateValue > 0
                  ? `${activeDateValue}/${activeTargetCount}`
                  : "Check In"}
              </Button>
            )}

            <XStack items="center" gap="$1.5">
              {(isSkipped || isFailed) && (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleClearStatus}
                  disabled={isPending}
                  title="Undo"
                  aria-label="Undo"
                >
                  <Undo2 size={14} />
                </IconButton>
              )}
              {activeDateValue > 0 && !isSkipped && !isFailed && (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleUndo}
                  disabled={isPending}
                  title="Undo last check-in"
                  aria-label="Undo last check-in"
                >
                  <Undo2 size={14} />
                </IconButton>
              )}
              {activeDateValue === 0 &&
                !isSkipped &&
                !isFailed &&
                isScheduledOnActiveDate && (
                  <>
                    <IconButton
                      variant="outline"
                      size="sm"
                      onPress={handleSkip}
                      disabled={isPending}
                      title="Skip"
                      aria-label="Skip"
                    >
                      <SkipForward size={14} />
                    </IconButton>
                    <IconButton
                      variant="outline"
                      intent="danger"
                      size="sm"
                      onPress={handleFail}
                      disabled={isPending}
                      title="Mark failed — resets the streak"
                      aria-label="Mark failed"
                    >
                      <X size={14} />
                    </IconButton>
                  </>
                )}
            </XStack>
          </XStack>
        )}
      </View>

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
