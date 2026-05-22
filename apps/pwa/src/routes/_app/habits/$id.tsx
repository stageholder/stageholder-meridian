import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isFuture,
  isToday as isTodayFn,
} from "date-fns";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Undo2,
} from "lucide-react";
import {
  AlertDialog,
  Button,
  H1,
  H3,
  Paragraph,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { EditHabitSheet } from "@/components/habits/edit-habit-sheet";
import {
  useHabit,
  useHabitEntries,
  useCreateHabitEntry,
  useUpdateHabitEntry,
  useSkipHabitEntry,
  useDeleteHabit,
} from "@/lib/api/habits";
import { toast } from "sonner";
import type { HabitEntry } from "@repo/core/types";
import {
  resolveTargetCount,
  isEntryComplete,
} from "@/lib/habits/entry-resolution";

export const Route = createFileRoute("/_app/habits/$id")({
  component: HabitDetailPage,
});

function HabitDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: habit, isLoading } = useHabit(id);
  const deleteHabit = useDeleteHabit();
  const createEntry = useCreateHabitEntry();
  const updateEntry = useUpdateHabitEntry();
  const skipEntryMutation = useSkipHabitEntry();
  const [editOpen, setEditOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const { data: allEntries } = useHabitEntries(id, {
    startDate: ninetyDaysAgo,
    endDate: today,
  });

  // Entries for the visible calendar month
  const calMonthStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
  const calMonthEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd");
  const { data: monthEntries } = useHabitEntries(id, {
    startDate: calMonthStart,
    endDate: calMonthEnd,
  });

  // Build entry map for quick lookup (stores value + type + snapshot for streak/skip logic)
  const entryMap = useMemo(() => {
    const map = new Map<
      string,
      { value: number; type?: string; targetCountSnapshot?: number }
    >();
    for (const e of allEntries || []) {
      const dateStr = e.date.split("T")[0]!;
      const existing = map.get(dateStr);
      map.set(dateStr, {
        value: (existing?.value ?? 0) + e.value,
        type: e.type || existing?.type || "completion",
        targetCountSnapshot:
          existing?.targetCountSnapshot ?? e.targetCountSnapshot,
      });
    }
    return map;
  }, [allEntries]);

  const monthEntryMap = useMemo(() => {
    const map = new Map<string, { value: number; type?: string }>();
    for (const e of monthEntries || []) {
      const dateStr = e.date.split("T")[0]!;
      const existing = map.get(dateStr);
      map.set(dateStr, {
        value: (existing?.value ?? 0) + e.value,
        type: e.type || existing?.type || "completion",
      });
    }
    return map;
  }, [monthEntries]);

  // Map date -> entry object (for PATCH/undo)
  const monthEntryObjMap = useMemo(() => {
    const map = new Map<string, HabitEntry>();
    for (const e of monthEntries || []) {
      const dateStr = e.date.split("T")[0]!;
      map.set(dateStr, e);
    }
    return map;
  }, [monthEntries]);

  // Stats
  const stats = useMemo(() => {
    if (!habit)
      return {
        streak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        completionRate: 0,
      };

    const hasSchedule = habit.scheduledDays && habit.scheduledDays.length > 0;
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

    // Current streak (skips non-scheduled days; skip entries preserve but don't extend)
    const todayDow = now.getDay();
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
    let currentStreak = todayCompleted ? 1 : 0;
    for (let i = 1; i <= 90; i++) {
      const checkDay = subDays(now, i);
      const dow = checkDay.getDay();
      if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;
      const d = format(checkDay, "yyyy-MM-dd");
      const dayEntry = entryMap.get(d);
      if (dayEntry?.type === "skip") continue; // skip preserves streak
      if (dayEntry?.type === "fail") break; // explicit fail breaks the chain
      const dayTarget = resolveTargetCount(
        { targetCountSnapshot: dayEntry?.targetCountSnapshot },
        habit,
      );
      if ((dayEntry?.value ?? 0) >= dayTarget) currentStreak++;
      else break;
    }

    // Longest streak + total completions. Skip preserves and is ignored;
    // fail resets the running streak just like a missed scheduled day.
    let longestStreak = 0;
    let tempStreak = 0;
    let totalCompletions = 0;
    for (let i = 90; i >= 0; i--) {
      const checkDay = subDays(now, i);
      const dow = checkDay.getDay();
      if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;
      const d = format(checkDay, "yyyy-MM-dd");
      const dayEntry = entryMap.get(d);
      if (dayEntry?.type === "skip") continue; // skip preserves streak
      if (dayEntry?.type === "fail") {
        tempStreak = 0;
        continue;
      }
      const dayTarget = resolveTargetCount(
        { targetCountSnapshot: dayEntry?.targetCountSnapshot },
        habit,
      );
      if ((dayEntry?.value ?? 0) >= dayTarget) {
        tempStreak++;
        totalCompletions++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Completion rate (days with entries / total days since first entry)
    const daysWithData = Array.from(entryMap.keys()).length;
    const completionRate =
      daysWithData > 0
        ? Math.round((totalCompletions / Math.min(daysWithData + 10, 91)) * 100)
        : 0;

    return {
      streak: currentStreak,
      longestStreak,
      totalCompletions,
      completionRate,
    };
  }, [entryMap, habit]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);
    const offset = startDay === 0 ? 6 : startDay - 1; // Monday start
    return { days, offset };
  }, [calendarMonth]);

  // Recent entries (last 20)
  const recentEntries = useMemo(() => {
    return (allEntries || [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [allEntries]);

  const isMutating =
    createEntry.isPending ||
    updateEntry.isPending ||
    skipEntryMutation.isPending;

  function handleDateCheckIn(dateStr: string) {
    if (!habit) return;
    const existing = monthEntryObjMap.get(dateStr);
    const currentEntry = monthEntryMap.get(dateStr);
    const currentVal = currentEntry?.value ?? 0;

    const checkTarget = existing
      ? resolveTargetCount(existing, habit)
      : habit.targetCount;
    if (
      currentEntry?.type !== "skip" &&
      currentEntry?.type !== "fail" &&
      currentVal >= checkTarget
    ) {
      toast.info("Already completed for this date");
      return;
    }

    const onSuccess = () => toast.success(`Recorded for ${dateStr}`);
    const onError = () => toast.error("Failed to record");

    if (!existing) {
      createEntry.mutate(
        { habitId: habit.id, data: { date: dateStr, value: 1 } },
        { onSuccess, onError },
      );
      return;
    }

    // Entry exists. Promote skip/fail to completion or increment partial.
    const isNonCompletion =
      currentEntry?.type === "skip" || currentEntry?.type === "fail";
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: existing.id,
        data: isNonCompletion
          ? { type: "completion", value: 1 }
          : { value: currentVal + 1 },
      },
      { onSuccess, onError },
    );
  }

  function handleDateUndo(dateStr: string) {
    if (!habit) return;
    const existing = monthEntryObjMap.get(dateStr);
    const currentEntry = monthEntryMap.get(dateStr);
    if (
      !existing ||
      !currentEntry ||
      currentEntry.type === "skip" ||
      currentEntry.type === "fail" ||
      currentEntry.value <= 0
    )
      return;
    const currentVal = currentEntry.value;

    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: existing.id,
        data: { value: currentVal - 1 },
      },
      {
        onSuccess: () => toast.success(`Undid for ${dateStr}`),
        onError: () => toast.error("Failed to undo"),
      },
    );
  }

  // Convert a skip or fail entry back to an "open" state (completion / v=0)
  // so the user can record fresh — or simply clear the outcome. We never
  // DELETE because the Mongo per-(userSub, habit_id, date) unique index
  // doesn't filter soft-deleted rows; PATCH keeps the slot occupied.
  function handleClearNonCompletion(dateStr: string) {
    if (!habit) return;
    const existing = monthEntryObjMap.get(dateStr);
    const currentEntry = monthEntryMap.get(dateStr);
    if (
      !existing ||
      !currentEntry ||
      (currentEntry.type !== "skip" && currentEntry.type !== "fail")
    )
      return;

    const wasFail = currentEntry.type === "fail";
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: existing.id,
        data: { type: "completion", value: 0 },
      },
      {
        onSuccess: () =>
          toast.success(wasFail ? "Cleared fail" : "Cleared skip"),
        onError: () => toast.error("Failed to undo"),
      },
    );
  }

  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    deleteHabit.mutate(id, {
      onSuccess: () => {
        toast.success("Habit deleted");
        navigate({ to: "/habits" });
      },
      onError: () => toast.error("Failed to delete habit"),
    });
    setDeleteOpen(false);
  }

  if (isLoading) {
    return (
      <YStack gap="$4" p="$4">
        {/* allowlist: animate-pulse keyframe */}
        <View
          height={32}
          width={192}
          rounded="$sm"
          bg="$muted"
          className="animate-pulse"
        />
        <View
          height={16}
          width={128}
          rounded="$sm"
          bg="$muted"
          className="animate-pulse"
        />
      </YStack>
    );
  }

  if (!habit) {
    return (
      <YStack py="$8" items="center">
        <Paragraph fontSize="$3" color="$mutedForeground">
          Habit not found.
        </Paragraph>
      </YStack>
    );
  }

  const habitColor = habit.color || "#3b82f6";

  return (
    <YStack gap="$6" p="$4">
      {/* Header */}
      <XStack items="center" justify="space-between">
        <XStack items="center" gap="$3">
          <XStack
            tag="button"
            items="center"
            gap="$1"
            color="$mutedForeground"
            hoverStyle={{ color: "$color" }}
            onPress={() => navigate({ to: "/habits" })}
          >
            <ArrowLeft size={16} />
          </XStack>
          <View
            items="center"
            justify="center"
            height={40}
            width={40}
            rounded="$lg"
            fontSize="$6"
            // dynamic per-habit tint — stays inline
            style={{ backgroundColor: habitColor + "20" }}
          >
            <Text fontSize="$6">
              {habit.icon || habit.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <YStack>
            <H1 fontSize="$7" fontWeight="700" color="$color">
              {habit.name}
            </H1>
            {habit.description && (
              <Paragraph fontSize="$3" color="$mutedForeground">
                {habit.description}
              </Paragraph>
            )}
          </YStack>
        </XStack>
        <XStack items="center" gap="$2">
          <Button intent="outline" onPress={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button intent="destructive" onPress={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </XStack>
      </XStack>

      {/* Stats row */}
      <View
        display="grid"
        gap="$3"
        gridTemplateColumns={"repeat(2, minmax(0, 1fr))" as never}
        $sm={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" as never }}
      >
        <StatCard
          label="Current Streak"
          value={stats.streak}
          icon={
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
              className="text-orange-500"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
          }
          suffix=" days"
        />
        <StatCard
          label="Longest Streak"
          value={stats.longestStreak}
          suffix=" days"
        />
        <StatCard label="Total Completions" value={stats.totalCompletions} />
        <StatCard
          label="Completion Rate"
          value={stats.completionRate}
          suffix="%"
        />
      </View>

      {/* Calendar + Recent Entries — two-column on desktop, stacked on mobile */}
      <View
        display="grid"
        gap="$4"
        gridTemplateColumns={"1fr" as never}
        $lg={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" as never }}
      >
        {/* Monthly Calendar Heatmap */}
        <YStack
          rounded="$6"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$card"
          p="$5"
        >
          <XStack items="center" justify="space-between">
            <View
              tag="button"
              rounded="$md"
              p="$1"
              color="$mutedForeground"
              hoverStyle={{ bg: "$accent", color: "$color" }}
              onPress={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            >
              <ChevronLeft size={16} />
            </View>
            <H3 fontSize="$3" fontWeight="600" color="$color">
              {format(calendarMonth, "MMMM yyyy")}
            </H3>
            <View
              tag="button"
              rounded="$md"
              p="$1"
              color="$mutedForeground"
              hoverStyle={{ bg: "$accent", color: "$color" }}
              onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}
            >
              <ChevronRight size={16} />
            </View>
          </XStack>

          <View
            mt="$3"
            display="grid"
            gap="$1.5"
            gridTemplateColumns={"repeat(7, minmax(0, 1fr))" as never}
          >
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <Text
                key={i}
                fontSize={10}
                fontWeight="500"
                color="$mutedForeground"
                text="center"
              >
                {d}
              </Text>
            ))}
            {/* Offset empty cells */}
            {Array.from({ length: calendarDays.offset }).map((_, i) => (
              <View key={`empty-${i}`} />
            ))}
            {calendarDays.days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const monthEntry = monthEntryMap.get(dateStr);
              const value = monthEntry?.value ?? 0;
              const isDaySkipped = monthEntry?.type === "skip";
              const isDayFailed = monthEntry?.type === "fail";
              const entryObj = monthEntryObjMap.get(dateStr);
              const effectiveTarget = entryObj
                ? resolveTargetCount(entryObj, habit)
                : habit.targetCount;
              const ratio = effectiveTarget > 0 ? value / effectiveTarget : 0;
              const isComplete = !isDaySkipped && !isDayFailed && ratio >= 1;
              const isPartial =
                !isDaySkipped && !isDayFailed && ratio > 0 && ratio < 1;
              const isDayToday = dateStr === today;
              const isFutureDay = isFuture(day) && !isTodayFn(day);
              const isPastDay = !isFutureDay && !isDayToday;
              const isSelected = selectedDate === dateStr;
              const dow = getDay(day);
              const hasSchedule =
                habit.scheduledDays && habit.scheduledDays.length > 0;
              const isScheduled =
                !hasSchedule || habit.scheduledDays!.includes(dow);
              // Auto-fail: a past scheduled day with no entry (and after the
              // habit was created) reads identically to an explicit fail in
              // the streak math; render it the same way for consistency.
              const habitCreated = habit.createdAt?.slice(0, 10);
              const afterHabitCreation =
                !habitCreated || dateStr >= habitCreated;
              const isAutoFailed =
                !monthEntry && isPastDay && isScheduled && afterHabitCreation;
              const isAnyFail = isDayFailed || isAutoFailed;

              return (
                <XStack key={dateStr} items="center" justify="center">
                  <XStack
                    tag="button"
                    items="center"
                    justify="center"
                    height={32}
                    width={32}
                    rounded={9999}
                    fontSize={11}
                    transition="quick"
                    disabled={isFutureDay}
                    opacity={
                      isFutureDay ? 0.2 : !isScheduled ? 0.25 : undefined
                    }
                    cursor={isFutureDay ? "not-allowed" : "pointer"}
                    // today/selected ring approximated with a 2px border
                    borderWidth={
                      (isDayToday && !isSelected) || isSelected || isDaySkipped
                        ? 2
                        : undefined
                    }
                    borderStyle={isDaySkipped ? "dashed" : undefined}
                    borderColor={
                      isSelected
                        ? "$color"
                        : isDayToday && !isSelected
                          ? "$primary"
                          : isDaySkipped
                            ? "$mutedForeground"
                            : undefined
                    }
                    scale={isSelected ? 1.1 : undefined}
                    bg={isAnyFail ? "$destructive" : undefined}
                    fontWeight={
                      isComplete || isAnyFail
                        ? "600"
                        : isPartial
                          ? "500"
                          : undefined
                    }
                    color={
                      isComplete
                        ? "#ffffff"
                        : isAnyFail
                          ? "$destructiveForeground"
                          : isDaySkipped
                            ? "$mutedForeground"
                            : isPartial
                              ? "$color"
                              : "$mutedForeground"
                    }
                    hoverStyle={!isFutureDay ? { scale: 1.1 } : undefined}
                    onPress={() =>
                      !isFutureDay &&
                      setSelectedDate(isSelected ? null : dateStr)
                    }
                    // dynamic per-habit fill — stays inline
                    style={
                      isComplete
                        ? { backgroundColor: habitColor }
                        : isPartial
                          ? { backgroundColor: habitColor + "25" }
                          : undefined
                    }
                    title={`${dateStr}: ${isDayFailed ? "Failed" : isDaySkipped ? "Skipped" : isAutoFailed ? "Missed" : `${value}/${effectiveTarget}`}${!isScheduled ? " (rest day)" : ""}${isFutureDay ? " (future)" : ""}`}
                  >
                    {isComplete ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : isDaySkipped ? (
                      <Text fontSize={9}>—</Text>
                    ) : isAnyFail ? (
                      <Text fontSize={10}>✕</Text>
                    ) : (
                      <Text fontSize={11}>{day.getDate()}</Text>
                    )}
                  </XStack>
                </XStack>
              );
            })}
          </View>

          {/* Selected date action panel */}
          {selectedDate &&
            (() => {
              const selEntry = monthEntryMap.get(selectedDate);
              const selValue = selEntry?.value ?? 0;
              const selIsSkipped = selEntry?.type === "skip";
              const selIsFailed = selEntry?.type === "fail";
              const selEntryObj = monthEntryObjMap.get(selectedDate);
              const selEffectiveTarget = selEntryObj
                ? resolveTargetCount(selEntryObj, habit)
                : habit.targetCount;
              const selComplete =
                !selIsSkipped &&
                !selIsFailed &&
                selEffectiveTarget > 0 &&
                selValue >= selEffectiveTarget;
              const selDow = getDay(new Date(selectedDate + "T00:00:00"));
              const hasSchedule =
                habit.scheduledDays && habit.scheduledDays.length > 0;
              const selScheduled =
                !hasSchedule || habit.scheduledDays!.includes(selDow);
              const selIsToday = selectedDate === today;
              const selHasEntry = !!monthEntryObjMap.get(selectedDate);

              return (
                <XStack
                  mt="$4"
                  items="center"
                  justify="space-between"
                  rounded="$lg"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg="$muted"
                  px="$3"
                  py="$2.5"
                >
                  <XStack items="center" gap="$2">
                    <Text fontSize="$1" fontWeight="500" color="$color">
                      {format(
                        new Date(selectedDate + "T00:00:00"),
                        "MMM d, yyyy",
                      )}
                    </Text>
                    <Text
                      fontSize={10}
                      color={selIsFailed ? "$destructive" : "$mutedForeground"}
                    >
                      {selIsFailed
                        ? "Failed — streak reset"
                        : selIsSkipped
                          ? "Skipped"
                          : `${selValue}/${selEffectiveTarget}`}
                      {!selScheduled && " · Rest day"}
                    </Text>
                  </XStack>
                  <XStack items="center" gap="$1.5">
                    {selValue > 0 && !selIsSkipped && !selIsFailed && (
                      <XStack
                        tag="button"
                        items="center"
                        gap="$1"
                        rounded="$md"
                        borderWidth={1}
                        borderColor="$borderColor"
                        px="$2"
                        py="$1"
                        fontSize="$1"
                        color="$mutedForeground"
                        hoverStyle={{ bg: "$accent", color: "$color" }}
                        disabledStyle={{ opacity: 0.5 }}
                        disabled={isMutating}
                        onPress={() => handleDateUndo(selectedDate)}
                      >
                        <Undo2 size={12} />
                        Undo
                      </XStack>
                    )}
                    {selIsSkipped || selIsFailed ? (
                      // Recovery: PATCH the entry back to a value=0 completion
                      // so the user can Record again. The Fail button itself
                      // is mobile-only per current scope; this Undo lets a
                      // user fix a mobile-set fail from PWA.
                      <XStack
                        tag="button"
                        items="center"
                        gap="$1"
                        rounded="$md"
                        borderWidth={1}
                        borderColor="$borderColor"
                        px="$2"
                        py="$1"
                        fontSize="$1"
                        color="$mutedForeground"
                        hoverStyle={{ bg: "$accent", color: "$color" }}
                        disabledStyle={{ opacity: 0.5 }}
                        disabled={isMutating}
                        onPress={() => handleClearNonCompletion(selectedDate)}
                      >
                        <Undo2 size={12} />
                        Undo {selIsFailed ? "fail" : "skip"}
                      </XStack>
                    ) : null}
                    {selIsFailed ? (
                      <XStack
                        items="center"
                        gap="$1"
                        rounded="$md"
                        bg="$destructiveMuted"
                        px="$2.5"
                        py="$1"
                        fontSize="$1"
                        fontWeight="500"
                        color="$destructive"
                      >
                        ✕ Failed
                      </XStack>
                    ) : selIsSkipped ? (
                      <XStack
                        items="center"
                        gap="$1"
                        rounded="$md"
                        bg="$muted"
                        px="$2.5"
                        py="$1"
                        fontSize="$1"
                        fontWeight="500"
                        color="$mutedForeground"
                      >
                        <SkipForward size={12} />
                        Skipped
                      </XStack>
                    ) : selComplete ? (
                      <XStack
                        items="center"
                        gap="$1"
                        rounded="$md"
                        bg="$successMuted"
                        px="$2.5"
                        py="$1"
                        fontSize="$1"
                        fontWeight="500"
                        color="$success"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Done
                      </XStack>
                    ) : (
                      <>
                        {selIsToday && !selHasEntry && selScheduled && (
                          <Button
                            intent="outline"
                            size="sm"
                            icon={<SkipForward size={12} />}
                            onPress={() => {
                              skipEntryMutation.mutate(
                                {
                                  habitId: habit.id,
                                  data: { date: selectedDate },
                                },
                                {
                                  onSuccess: () =>
                                    toast.success(
                                      `Skipped for ${selectedDate}`,
                                    ),
                                  onError: () => toast.error("Failed to skip"),
                                },
                              );
                            }}
                            disabled={isMutating}
                          >
                            Skip
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onPress={() => handleDateCheckIn(selectedDate)}
                          disabled={isMutating}
                          loading={isMutating}
                          loadingText="…"
                        >
                          Record
                        </Button>
                      </>
                    )}
                  </XStack>
                </XStack>
              );
            })()}
        </YStack>

        {/* Recent Entries */}
        <YStack
          rounded="$6"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$card"
          p="$5"
        >
          <H3 fontSize="$3" fontWeight="600" color="$color">
            Recent Entries
          </H3>
          {recentEntries.length === 0 ? (
            <Paragraph mt="$3" fontSize="$1" color="$mutedForeground">
              No entries yet.
            </Paragraph>
          ) : (
            <YStack
              mt="$3"
              gap="$1.5"
              overflowY={"auto" as never}
              maxH={320}
              pr="$1"
              // allowlist: thin custom webkit scrollbar (no token equivalent)
              className="[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent"
            >
              {recentEntries.map((entry: HabitEntry) => {
                const dateStr = entry.date.split("T")[0]!;
                const entryIsSkip = entry.type === "skip";
                const entryIsFail = entry.type === "fail";
                const isComplete = isEntryComplete(entry, habit);
                return (
                  <XStack
                    key={entry.id}
                    items="center"
                    justify="space-between"
                    rounded="$lg"
                    borderWidth={1}
                    borderColor="$borderColor"
                    px="$3"
                    py="$2"
                  >
                    <XStack items="center" gap="$2">
                      <View
                        height={8}
                        width={8}
                        rounded={9999}
                        // status dot — fail/skip use kit tokens; complete/partial
                        // keep their semantic green/orange (no kit equivalent)
                        bg={
                          entryIsFail
                            ? "$destructive"
                            : entryIsSkip
                              ? "$mutedForeground"
                              : isComplete
                                ? "#22c55e"
                                : "#fb923c"
                        }
                      />
                      <Text fontSize="$3" color="$color">
                        {format(new Date(dateStr), "MMM d, yyyy")}
                      </Text>
                    </XStack>
                    <XStack items="center" gap="$2">
                      {entryIsFail ? (
                        <Text
                          fontSize="$1"
                          fontWeight="500"
                          color="$destructive"
                        >
                          Failed
                        </Text>
                      ) : entryIsSkip ? (
                        <Text fontSize="$1" color="$mutedForeground">
                          Skipped
                        </Text>
                      ) : (
                        <Text fontSize="$1" color="$mutedForeground">
                          {entry.value}/{resolveTargetCount(entry, habit)}
                        </Text>
                      )}
                      {entry.skipReason && (
                        <Text
                          maxW={120}
                          numberOfLines={1}
                          fontSize="$1"
                          color="$mutedForeground"
                        >
                          {entry.skipReason}
                        </Text>
                      )}
                      {entry.notes && !entryIsSkip && !entryIsFail && (
                        <Text
                          maxW={120}
                          numberOfLines={1}
                          fontSize="$1"
                          color="$mutedForeground"
                        >
                          {entry.notes}
                        </Text>
                      )}
                    </XStack>
                  </XStack>
                );
              })}
            </YStack>
          )}
        </YStack>
      </View>

      <EditHabitSheet
        habit={habit}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

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
    </YStack>
  );
}

function StatCard({
  label,
  value,
  icon,
  suffix = "",
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  suffix?: string;
}) {
  return (
    <YStack
      rounded="$6"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$card"
      p="$4"
    >
      <Paragraph fontSize="$1" color="$mutedForeground">
        {label}
      </Paragraph>
      <XStack mt="$0.5" items="center" gap="$1.5">
        {icon}
        <Text fontSize="$7" fontWeight="700" color="$color">
          {value}
          {suffix}
        </Text>
      </XStack>
    </YStack>
  );
}
