import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, subDays, startOfMonth, endOfMonth, getDay } from "date-fns";
import { ArrowLeft, Check, Minus, SkipForward, Undo2, X } from "lucide-react";
import {
  AlertDialog,
  Button,
  EventCalendar,
  H1,
  H3,
  IconButton,
  Paragraph,
  Stat,
  StreakBadge,
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
import { parseDateLocal } from "@/lib/date";

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  // A full year of history powers the year-long Activity heatmap (and the
  // streak/stat/recent-entry computations below).
  const yearAgo = format(subDays(new Date(), 365), "yyyy-MM-dd");

  const { data: allEntries } = useHabitEntries(id, {
    startDate: yearAgo,
    endDate: today,
  });

  // Entries for the month of the day being edited (defaults to current month).
  // This window backs the action panel's entry lookups for PATCH/undo, so it
  // tracks whichever day the Calendar has selected.
  const editAnchor = selectedDate ? parseDateLocal(selectedDate) : new Date();
  const calMonthStart = format(startOfMonth(editAnchor), "yyyy-MM-dd");
  const calMonthEnd = format(endOfMonth(editAnchor), "yyyy-MM-dd");
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

  // Per-day completion keyed by yyyy-MM-dd — drives the month calendar's day
  // tinting (complete / partial / skip / fail) in renderDayCell.
  const dayMap = useMemo(() => {
    const m = new Map<
      string,
      { value: number; target: number; type?: string }
    >();
    if (!habit) return m;
    for (const e of allEntries || []) {
      const dateStr = e.date.split("T")[0]!;
      const existing = m.get(dateStr);
      m.set(dateStr, {
        value: (existing?.value ?? 0) + e.value,
        target: resolveTargetCount(e, habit),
        type: e.type || existing?.type,
      });
    }
    return m;
  }, [allEntries, habit]);

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

  // Orange = the habit category identity color (the same `--ring-habit` the
  // calendar page uses for habits). The whole habit page reads as "orange =
  // habit" instead of the per-habit blue default.
  const habitColor = "var(--ring-habit)";
  const habitTrack = "var(--ring-habit-track)";

  return (
    <YStack
      gap="$6"
      p="$4"
      width="100%"
      maxW={1040}
      style={{ marginLeft: "auto", marginRight: "auto" }}
    >
      {/* Header */}
      <XStack items="center" justify="space-between">
        <XStack items="center" gap="$3">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Back to habits"
            onPress={() => navigate({ to: "/habits" })}
          >
            <ArrowLeft size={16} />
          </IconButton>
          <View
            items="center"
            justify="center"
            height={40}
            width={40}
            rounded="$lg"
            fontSize="$6"
            // habit identity tint (faint orange)
            style={{ backgroundColor: habitTrack }}
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
        {/* Current streak uses the kit StreakBadge (auto-tiers cold→blazing). */}
        <Stat
          rounded="$6"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$card"
          p="$4"
        >
          <Stat.Label color="$mutedForeground">Current Streak</Stat.Label>
          <View mt="$1.5" items="flex-start">
            <StreakBadge count={stats.streak} size="$3" label="days" />
          </View>
        </Stat>
        <Stat
          rounded="$6"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$card"
          p="$4"
        >
          <Stat.Label color="$mutedForeground">Longest Streak</Stat.Label>
          <Stat.Value color="$color">{stats.longestStreak} days</Stat.Value>
        </Stat>
        <Stat
          rounded="$6"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$card"
          p="$4"
        >
          <Stat.Label color="$mutedForeground">Total Completions</Stat.Label>
          <Stat.Value color="$color">{stats.totalCompletions}</Stat.Value>
        </Stat>
        <Stat
          rounded="$6"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$card"
          p="$4"
        >
          <Stat.Label color="$mutedForeground">Completion Rate</Stat.Label>
          <Stat.Value color="$color">{stats.completionRate}%</Stat.Value>
        </Stat>
      </View>

      {/* Day editor + Recent Entries. Fixed calendar column + flexible entries
          column (mirrors the calendar page's sizing), stacked on mobile. */}
      <View
        display="grid"
        gap="$6"
        gridTemplateColumns={"1fr" as never}
        $lg={{
          gridTemplateColumns: "minmax(0, 440px) minmax(0, 1fr)" as never,
          alignItems: "start" as never,
        }}
      >
        {/* Interactive calendar for picking any day to edit (no card). */}
        <YStack gap="$3">
          <H3 fontSize="$3" fontWeight="600" color="$color">
            Edit a day
          </H3>
          {/* Compact 7-wide month calendar (column-constrained like the
              calendar page; built-in month nav). Days tinted by completion;
              click one to load it into the panel below. */}
          <EventCalendar
            events={[]}
            variant="month"
            density="compact"
            todayIndicator="none"
            onDateClick={(date) => setSelectedDate(format(date, "yyyy-MM-dd"))}
            renderDayCell={({ date, isToday }) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const d = dayMap.get(dateStr);
              const isFuture = dateStr > today;
              const isSelected = dateStr === selectedDate;
              const dow = date.getDay();
              const isScheduled =
                !habit.scheduledDays?.length ||
                habit.scheduledDays.includes(dow);
              const isSkip = d?.type === "skip";
              const isFail = d?.type === "fail";
              const isComplete =
                !!d && !isSkip && !isFail && d.value >= d.target;
              const ratio =
                d && d.target > 0 ? Math.min(d.value / d.target, 1) : 0;
              const partial = !isComplete && !isSkip && !isFail && ratio > 0;

              // The month reads as the habit's ORANGE rhythm: completed days
              // fill solid orange (soft glow), partial a faint orange, today an
              // orange wash. Skipped = dashed; missed / rest stay plain. No
              // generic blue, no rings.
              let bgToken: string | undefined;
              let bgStyle: Record<string, string> | undefined;
              if (isComplete)
                bgStyle = {
                  backgroundColor: habitColor,
                  boxShadow: "0 0 8px var(--ring-habit-track)",
                };
              else if (partial) bgStyle = { backgroundColor: habitTrack };
              else if (isFail) bgToken = "$destructiveMuted";
              else if (isToday) bgStyle = { backgroundColor: habitTrack };
              else if (isSelected) bgToken = "$accent";

              return (
                <YStack flex={1} items="center" justify="center" py="$1">
                  <View
                    width={32}
                    height={32}
                    rounded={9999}
                    items="center"
                    justify="center"
                    opacity={isFuture || (!isScheduled && !d) ? 0.4 : 1}
                    borderWidth={isSkip ? 1 : 0}
                    borderStyle="dashed"
                    borderColor="$mutedForeground"
                    bg={bgToken as never}
                    style={bgStyle}
                  >
                    <Text
                      fontSize={12}
                      fontWeight={
                        isComplete || isToday || isSelected ? "700" : "500"
                      }
                      color={(isComplete ? "#ffffff" : "$color") as never}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </YStack>
              );
            }}
          />

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
              const selDow = getDay(parseDateLocal(selectedDate));
              const hasSchedule =
                habit.scheduledDays && habit.scheduledDays.length > 0;
              const selScheduled =
                !hasSchedule || habit.scheduledDays!.includes(selDow);
              const selIsToday = selectedDate === today;
              const selHasEntry = !!monthEntryObjMap.get(selectedDate);

              return (
                <XStack
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
                      {format(parseDateLocal(selectedDate), "MMM d, yyyy")}
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
                      <Button
                        intent="outline"
                        size="sm"
                        icon={<Undo2 size={12} />}
                        disabled={isMutating}
                        onPress={() => handleDateUndo(selectedDate)}
                      >
                        Undo
                      </Button>
                    )}
                    {selIsSkipped || selIsFailed ? (
                      // Recovery: PATCH the entry back to a value=0 completion
                      // so the user can Record again. The Fail button itself
                      // is mobile-only per current scope; this Undo lets a
                      // user fix a mobile-set fail from PWA.
                      <Button
                        intent="outline"
                        size="sm"
                        icon={<Undo2 size={12} />}
                        disabled={isMutating}
                        onPress={() => handleClearNonCompletion(selectedDate)}
                      >
                        Undo {selIsFailed ? "fail" : "skip"}
                      </Button>
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
                        <X size={12} />
                        Failed
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
                        <Check size={12} />
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

        {/* Recent Entries (no card) */}
        <YStack>
          <H3 fontSize="$3" fontWeight="600" color="$color">
            Recent Entries
          </H3>
          {recentEntries.length === 0 ? (
            <Paragraph mt="$3" fontSize="$1" color="$mutedForeground">
              No entries yet.
            </Paragraph>
          ) : (
            <YStack mt="$3" gap="$1.5" overflowY={"auto" as never} maxH={320}>
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
                      {/* Status icon — lucide glyph inherits currentColor from
                          its wrapper. Fail/skip use semantic tokens; complete
                          keeps its green hex via the style escape hatch (no kit
                          token); partial stays a small orange-hex dot. */}
                      {entryIsFail ? (
                        <Text color="$destructive">
                          <X size={14} />
                        </Text>
                      ) : entryIsSkip ? (
                        <Text color="$mutedForeground">
                          <Minus size={14} />
                        </Text>
                      ) : isComplete ? (
                        <Text style={{ color: "#22c55e" }}>
                          <Check size={14} />
                        </Text>
                      ) : (
                        <View
                          height={8}
                          width={8}
                          rounded={9999}
                          style={{ backgroundColor: "#fb923c" }}
                        />
                      )}
                      <Text fontSize="$3" color="$color">
                        {format(parseDateLocal(dateStr), "MMM d, yyyy")}
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
