import { useState } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Check, MoreHorizontal, SkipForward, Undo2 } from "lucide-react";
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
import { resolveTargetCount } from "@/lib/habits/entry-resolution";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  H3,
  IconButton,
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
      <View
        position="relative"
        rounded="$6"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        p="$5"
        transition="medium"
        // allowlist: habit-card-completing — bespoke completion keyframe (no token equivalent)
        className={completing ? "habit-card-completing" : undefined}
      >
        <RadianceBurst active={completing} color={habitColor} />
        <XStack items="flex-start" justify="space-between">
          {/* Keep <Link> for routing (prefetch + middle-click); style lives on
              the inner XStack so the kit tokens/hover apply. */}
          <Link
            to="/habits/$id"
            params={{ id: habit.id }}
            style={{ textDecoration: "none" }}
          >
            <XStack
              items="center"
              gap="$3"
              transition="quick"
              hoverStyle={{ opacity: 0.8 }}
            >
              {/* Icon badge tinted with the habit's free-form color (no token) */}
              <View
                height={40}
                width={40}
                items="center"
                justify="center"
                rounded="$lg"
                style={{ backgroundColor: habitColor + "20" }}
              >
                <Text fontSize="$6" color="$cardForeground">
                  {habit.icon || habit.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <YStack>
                <H3 fontSize="$3" fontWeight="600" color="$color">
                  {habit.name}
                </H3>
                {habit.description && (
                  <Text fontSize="$1" color="$mutedForeground">
                    {habit.description}
                  </Text>
                )}
              </YStack>
            </XStack>
          </Link>
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

        <View mt="$4">
          <HabitProgress
            value={activeDateValue}
            targetCount={activeTargetCount}
            color={habit.color}
            streak={streak}
          />
        </View>

        {/* Week dots */}
        <XStack mt="$3" justify="space-between" px="$1">
          {weekDays.map((day) => {
            const ratio =
              day.effectiveTarget > 0 ? day.value / day.effectiveTarget : 0;
            const isDaySkipped = day.type === "skip";
            const isDayFailed = day.type === "fail";
            // "Today" highlight = a 1px primary ring with a 1px background-colored
            // offset (Tailwind ring-1 ring-offset-1 ring-offset-background).
            const todayRing = day.isToday
              ? ({
                  outlineWidth: 1,
                  outlineColor: "$primary",
                  outlineStyle: "solid",
                  outlineOffset: 1,
                } as const)
              : undefined;
            return (
              <YStack key={day.dateStr} items="center" gap="$1">
                <Text
                  fontSize={10}
                  color="$mutedForeground"
                  opacity={day.isScheduled ? 1 : 0.4}
                >
                  {day.label}
                </Text>
                {isDayFailed ? (
                  <View
                    height={14}
                    width={14}
                    items="center"
                    justify="center"
                    rounded={9999}
                    // destructive at 80% (Tailwind bg-destructive/80); the alpha
                    // is fill-only so the glyph stays crisp — via style hatch.
                    style={{ backgroundColor: "rgba(231, 0, 11, 0.8)" }}
                    title="Failed"
                    {...todayRing}
                  >
                    <Text
                      fontSize={8}
                      lineHeight={0}
                      color="$destructiveForeground"
                    >
                      ✕
                    </Text>
                  </View>
                ) : isDaySkipped ? (
                  <View
                    height={14}
                    width={14}
                    items="center"
                    justify="center"
                    rounded={9999}
                    borderWidth={1}
                    borderStyle="dashed"
                    borderColor="$mutedForeground"
                    // muted-foreground/40 dashed ring — alpha via opacity keeps
                    // it theme-aware (token differs per light/dark).
                    opacity={0.4}
                    title="Skipped"
                    {...todayRing}
                  >
                    <Text fontSize={8} lineHeight={0} color="$mutedForeground">
                      —
                    </Text>
                  </View>
                ) : ratio >= 1 ? (
                  <Text
                    fontSize="$3"
                    lineHeight={0}
                    title={`${day.value}/${day.effectiveTarget}`}
                  >
                    🔥
                  </Text>
                ) : (
                  <View
                    height={14}
                    width={14}
                    rounded={9999}
                    borderWidth={1}
                    transition="medium"
                    borderStyle={!day.isScheduled ? "dashed" : "solid"}
                    borderColor={
                      !day.isScheduled
                        ? "$mutedForeground"
                        : ratio > 0
                          ? "transparent"
                          : "$mutedForeground"
                    }
                    // Non-scheduled/empty dots read as faint outlines; tinted
                    // fill (when in progress) uses the habit's free-form color.
                    opacity={!day.isScheduled ? 0.2 : ratio > 0 ? 1 : 0.3}
                    style={
                      day.isScheduled && ratio > 0
                        ? {
                            backgroundColor: habitColor + "60",
                            borderColor: habitColor + "60",
                          }
                        : undefined
                    }
                    {...todayRing}
                  />
                )}
              </YStack>
            );
          })}
        </XStack>

        <XStack mt="$4" items="center" justify="space-between">
          <Text fontSize="$1" color="$mutedForeground">
            {habit.unit
              ? `${habit.targetCount} ${habit.unit}`
              : `${habit.targetCount}x target`}
          </Text>
          <XStack items="center" gap="$1.5">
            {activeDateValue > 0 && !isSkipped && (
              <IconButton
                variant="outline"
                size="sm"
                onPress={handleUndo}
                disabled={isPending}
                title="Undo last check-in"
                aria-label="Undo last check-in"
              >
                <Undo2 size={12} />
              </IconButton>
            )}
            {isSkipped ? (
              <XStack
                items="center"
                gap="$1"
                rounded="$lg"
                bg="$muted"
                px="$3"
                py="$1.5"
              >
                <Text color="$mutedForeground" lineHeight={0}>
                  <SkipForward size={12} />
                </Text>
                <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                  Skipped
                </Text>
              </XStack>
            ) : !isScheduledOnActiveDate && !isComplete ? (
              <View rounded="$lg" px="$3" py="$1.5">
                <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                  Rest day
                </Text>
              </View>
            ) : isComplete ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$lg"
                px="$3"
                py="$1.5"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
                bg="$successMuted"
              >
                <Text color="$success" lineHeight={0}>
                  <Check size={14} />
                </Text>
                <Text fontSize="$1" fontWeight="500" color="$success">
                  Complete
                </Text>
              </XStack>
            ) : (
              <>
                {!activeDateEntry && isScheduledOnActiveDate && (
                  <Button
                    intent="outline"
                    size="sm"
                    icon={<SkipForward size={12} />}
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
                  transition="quick"
                  scale={bouncing ? 1.1 : 1}
                >
                  {habit.targetCount > 1
                    ? `${activeDateValue}/${habit.targetCount}`
                    : "Check In"}
                </Button>
              </>
            )}
          </XStack>
        </XStack>
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
