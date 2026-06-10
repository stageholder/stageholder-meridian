// apps/mobile/app/(authed)/habits/[id].tsx
//
// Habit detail — native mirror of the PWA's /habits/$id (apps/pwa/src/routes/
// _app/habits/$id.tsx), single-column for phones. Sections, in order:
//
//   HEADER     — back · icon chip (habit-orange track) · name/description ·
//                edit + delete actions.
//   STATS      — current streak (kit StreakBadge), longest streak, total
//                completions, completion rate — 2-up flexWrap cards. Quota
//                (weekly_target) habits streak in WEEKS and show the
//                "This week: X/Y" line.
//   DAY EDITOR — kit EventCalendar month grid (cross-platform; tinted day
//                cells: solid orange = complete, faint = partial/today,
//                red = failed/missed, dashed = skipped) + the selected-day
//                action panel (Record / Undo / Skip / Fail / clear).
//   RECENT     — last 20 entries with status glyphs.
//
// All streak/stat computations are ported VERBATIM from the PWA page (same
// @repo/core/habits/entry-resolution helpers), so the two surfaces can never
// disagree on a streak. Colors come from IGNITION.habit (the native ring
// palette) instead of the web's --ring-habit CSS vars.
//
// Mobile deviations: Edit reuses the existing EditHabitDialog (FormSheet);
// delete confirms via the platform Alert (RN's native confirm idiom) instead
// of the web AlertDialog.

import {
  Button,
  EventCalendar,
  IconButton,
  ScrollView,
  Skeleton,
  Stat,
  StreakBadge,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Habit, HabitEntry } from "@repo/core/types";
import {
  resolveTargetCount,
  isEntryComplete,
  calculateWeeklyStreak,
  weeklyCompletions,
} from "@repo/core/habits/entry-resolution";
import {
  Check,
  ChevronLeft,
  Minus,
  Pencil,
  SkipForward,
  Trash2,
  Undo2,
  X,
} from "@tamagui/lucide-icons-2";
import {
  format,
  getDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { EditHabitDialog } from "@/components/edit-habit-dialog";
import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { IGNITION } from "@/lib/ignition-palette";
import {
  useCheckInHabit,
  useDeleteHabit,
  useFailHabit,
  useHabit,
  useHabitEntries,
  useSkipHabit,
  useUpdateHabitEntry,
} from "@/lib/api";

function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { data: habit, isLoading } = useHabit(id);
  const deleteHabit = useDeleteHabit();
  const checkIn = useCheckInHabit();
  const updateEntry = useUpdateHabitEntry();
  const skipEntry = useSkipHabit();
  const failEntry = useFailHabit();

  const [editOpen, setEditOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const yearAgo = format(subDays(new Date(), 365), "yyyy-MM-dd");
  const { data: allEntries } = useHabitEntries(id, {
    startDate: yearAgo,
    endDate: today,
  });

  // Month window for the day being edited — backs the action panel's
  // PATCH/undo entry lookups (tracks the calendar's selected day).
  const editAnchor = selectedDate ? parseDateLocal(selectedDate) : new Date();
  const { data: monthEntries } = useHabitEntries(id, {
    startDate: format(startOfMonth(editAnchor), "yyyy-MM-dd"),
    endDate: format(endOfMonth(editAnchor), "yyyy-MM-dd"),
  });

  /* ---- Entry maps + stats — ported VERBATIM from the PWA page ---- */

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

  const monthEntryObjMap = useMemo(() => {
    const map = new Map<string, HabitEntry>();
    for (const e of monthEntries || []) map.set(e.date.split("T")[0]!, e);
    return map;
  }, [monthEntries]);

  const isQuota = habit?.frequency === "weekly_target";

  const stats = useMemo(() => {
    if (!habit)
      return {
        streak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        completionRate: 0,
        weeklyProgress: 0,
      };

    if (habit.frequency === "weekly_target") {
      const quota = habit.weeklyTarget ?? 1;
      const now = new Date();
      const streak = calculateWeeklyStreak(entryMap, habit);
      const weeklyProgress = weeklyCompletions(
        entryMap,
        startOfWeek(now, { weekStartsOn: 1 }),
        habit,
      );

      let longestStreak = 0;
      let tempStreak = 0;
      let weeksMet = 0;
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const createdStr = habit.createdAt?.slice(0, 10);
      let weeksElapsed = 53;
      if (createdStr) {
        const createdWeekStart = startOfWeek(
          new Date(createdStr + "T00:00:00"),
          { weekStartsOn: 1 },
        );
        const diff = Math.round(
          (currentWeekStart.getTime() - createdWeekStart.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        weeksElapsed = Math.max(1, Math.min(53, diff + 1));
      }
      for (let w = 52; w >= 0; w--) {
        const c = weeklyCompletions(
          entryMap,
          startOfWeek(subWeeks(now, w), { weekStartsOn: 1 }),
          habit,
        );
        if (c >= quota) {
          tempStreak++;
          weeksMet++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      let totalCompletions = 0;
      for (const v of entryMap.values()) {
        if (v.type === "skip" || v.type === "fail") continue;
        if (
          v.value >=
          resolveTargetCount(
            { targetCountSnapshot: v.targetCountSnapshot },
            habit,
          )
        ) {
          totalCompletions++;
        }
      }

      const completionRate = Math.round(
        (weeksMet / Math.max(1, weeksElapsed)) * 100,
      );
      return {
        streak,
        longestStreak,
        totalCompletions,
        completionRate,
        weeklyProgress,
      };
    }

    const hasSchedule = habit.scheduledDays && habit.scheduledDays.length > 0;
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

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
      if (dayEntry?.type === "skip") continue;
      if (dayEntry?.type === "fail") break;
      const dayTarget = resolveTargetCount(
        { targetCountSnapshot: dayEntry?.targetCountSnapshot },
        habit,
      );
      if ((dayEntry?.value ?? 0) >= dayTarget) currentStreak++;
      else break;
    }

    let longestStreak = 0;
    let tempStreak = 0;
    let totalCompletions = 0;
    for (let i = 90; i >= 0; i--) {
      const checkDay = subDays(now, i);
      const dow = checkDay.getDay();
      if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;
      const d = format(checkDay, "yyyy-MM-dd");
      const dayEntry = entryMap.get(d);
      if (dayEntry?.type === "skip") continue;
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
      weeklyProgress: 0,
    };
  }, [entryMap, habit]);

  // Per-day completion — drives the month calendar's day tinting.
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

  const recentEntries = useMemo(
    () =>
      (allEntries || [])
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20),
    [allEntries],
  );

  const isMutating =
    checkIn.isPending ||
    updateEntry.isPending ||
    skipEntry.isPending ||
    failEntry.isPending;

  /* ---- Day actions — same create-or-PATCH decisions as the PWA ---- */

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
      toast.show({ title: "Already completed for this date", intent: "info" });
      return;
    }
    const onSuccess = () =>
      toast.show({ title: `Recorded for ${dateStr}`, intent: "success" });
    const onError = () =>
      toast.show({ title: "Failed to record", intent: "danger" });

    if (!existing) {
      checkIn.mutate(
        { habitId: habit.id, date: dateStr, value: 1 },
        { onSuccess, onError },
      );
      return;
    }
    const isNonCompletion =
      currentEntry?.type === "skip" || currentEntry?.type === "fail";
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: existing.id,
        patch: isNonCompletion
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
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: existing.id,
        patch: { value: currentEntry.value - 1 },
      },
      {
        onSuccess: () =>
          toast.show({ title: `Undid for ${dateStr}`, intent: "success" }),
        onError: () =>
          toast.show({ title: "Failed to undo", intent: "danger" }),
      },
    );
  }

  function handleDateFail(dateStr: string) {
    if (!habit) return;
    const existing = monthEntryObjMap.get(dateStr);
    const onSuccess = () =>
      toast.show({ title: `Marked failed for ${dateStr}`, intent: "success" });
    const onError = () =>
      toast.show({ title: "Failed to update", intent: "danger" });
    if (!existing) {
      failEntry.mutate(
        { habitId: habit.id, date: dateStr },
        { onSuccess, onError },
      );
      return;
    }
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: existing.id,
        patch: { type: "fail", value: 0 },
      },
      { onSuccess, onError },
    );
  }

  function handleDateSkip(dateStr: string) {
    if (!habit) return;
    const existing = monthEntryObjMap.get(dateStr);
    const onSuccess = () =>
      toast.show({ title: `Skipped ${dateStr}`, intent: "success" });
    const onError = () =>
      toast.show({ title: "Failed to skip", intent: "danger" });
    if (!existing) {
      skipEntry.mutate(
        { habitId: habit.id, date: dateStr },
        { onSuccess, onError },
      );
      return;
    }
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: existing.id,
        patch: { type: "skip", value: 0 },
      },
      { onSuccess, onError },
    );
  }

  // PATCH back to a value-0 completion (never DELETE — the per-day unique
  // index doesn't filter soft-deleted rows; PATCH keeps the slot occupied).
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
        patch: { type: "completion", value: 0 },
      },
      {
        onSuccess: () =>
          toast.show({
            title: wasFail ? "Cleared fail" : "Cleared skip",
            intent: "success",
          }),
        onError: () =>
          toast.show({ title: "Failed to undo", intent: "danger" }),
      },
    );
  }

  // Platform-native destructive confirm (the RN idiom; the PWA uses its
  // web AlertDialog for the same copy).
  function confirmDelete() {
    if (!habit) return;
    Alert.alert(
      `Delete "${habit.name}"?`,
      "This cannot be undone. All check-ins for this habit will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteHabit.mutate(habit.id, {
              onSuccess: () => {
                toast.show({ title: "Habit deleted", intent: "success" });
                router.navigate("/habits");
              },
              onError: () =>
                toast.show({
                  title: "Failed to delete habit",
                  intent: "danger",
                }),
            }),
        },
      ],
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Back bar — chevron · centered title · edit/delete actions. */}
        <XStack items="center" justify="space-between" px="$2" py="$2">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Back to habits"
            onPress={() => router.navigate("/habits")}
          >
            <ChevronLeft size={20} />
          </IconButton>
          <XStack items="center" gap="$1">
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Edit habit"
              onPress={() => setEditOpen(true)}
            >
              <Pencil size={18} />
            </IconButton>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Delete habit"
              onPress={confirmDelete}
            >
              <Trash2 size={18} color="$destructive" />
            </IconButton>
          </XStack>
        </XStack>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            pb: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
          {isLoading || !habit ? (
            <YStack gap="$3" px="$4" pt="$2">
              {isLoading ? (
                <>
                  <Skeleton height={32} width={192} rounded="$3" />
                  <Skeleton height={16} width={128} rounded="$3" />
                </>
              ) : (
                <Text fontSize="$3" color="$mutedForeground">
                  Habit not found.
                </Text>
              )}
            </YStack>
          ) : (
            <YStack gap="$5" px="$4" pt="$1" pb="$10">
              {/* ---- Identity header ---- */}
              <XStack items="center" gap="$3">
                <View
                  items="center"
                  justify="center"
                  height={44}
                  width={44}
                  rounded="$4"
                  bg={IGNITION.habit.track}
                >
                  <Text fontSize="$6">
                    {habit.icon || habit.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <YStack flex={1} minW={0}>
                  <Text
                    fontSize="$7"
                    fontWeight="700"
                    color="$color"
                    numberOfLines={1}
                  >
                    {habit.name}
                  </Text>
                  {habit.description ? (
                    <Text
                      fontSize="$2"
                      color="$mutedForeground"
                      numberOfLines={2}
                    >
                      {habit.description}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>

              {isQuota ? (
                <Text fontSize="$3" fontWeight="500" color="$mutedForeground">
                  This week:{" "}
                  <Text fontSize="$3" fontWeight="700" color="$color">
                    {stats.weeklyProgress}/{habit.weeklyTarget}
                  </Text>
                </Text>
              ) : null}

              {/* ---- Stats (2-up flexWrap, PWA parity) ---- */}
              <XStack flexWrap="wrap" gap="$2.5">
                <Stat
                  flex={1}
                  minW={140}
                  rounded="$6"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg="$card"
                  p="$3.5"
                >
                  <Stat.Label color="$mutedForeground">
                    {isQuota ? "Streak (weeks)" : "Current Streak"}
                  </Stat.Label>
                  <View mt="$1.5" items="flex-start">
                    <StreakBadge
                      count={stats.streak}
                      size="$3"
                      label={isQuota ? "wks" : "days"}
                    />
                  </View>
                </Stat>
                <Stat
                  flex={1}
                  minW={140}
                  rounded="$6"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg="$card"
                  p="$3.5"
                >
                  <Stat.Label color="$mutedForeground">
                    Longest Streak
                  </Stat.Label>
                  <Stat.Value color="$color">
                    {stats.longestStreak} {isQuota ? "wks" : "days"}
                  </Stat.Value>
                </Stat>
                <Stat
                  flex={1}
                  minW={140}
                  rounded="$6"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg="$card"
                  p="$3.5"
                >
                  <Stat.Label color="$mutedForeground">Completions</Stat.Label>
                  <Stat.Value color="$color">
                    {stats.totalCompletions}
                  </Stat.Value>
                </Stat>
                <Stat
                  flex={1}
                  minW={140}
                  rounded="$6"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg="$card"
                  p="$3.5"
                >
                  <Stat.Label color="$mutedForeground">
                    Completion Rate
                  </Stat.Label>
                  <Stat.Value color="$color">
                    {stats.completionRate}%
                  </Stat.Value>
                </Stat>
              </XStack>

              {/* ---- Day editor ---- */}
              <YStack gap="$3">
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Edit a day
                </Text>
                <EventCalendar
                  events={[]}
                  variant="month"
                  density="compact"
                  todayIndicator="none"
                  onDateClick={(date) =>
                    setSelectedDate(format(date, "yyyy-MM-dd"))
                  }
                  renderDayCell={({ date, isToday }) => (
                    <DayCell
                      date={date}
                      isToday={isToday}
                      today={today}
                      selectedDate={selectedDate}
                      dayMap={dayMap}
                      scheduledDays={habit.scheduledDays}
                      isQuota={isQuota}
                    />
                  )}
                />

                {selectedDate ? (
                  <DayActionPanel
                    selectedDate={selectedDate}
                    today={today}
                    habit={habit}
                    isQuota={isQuota}
                    isMutating={isMutating}
                    monthEntryMap={monthEntryMap}
                    monthEntryObjMap={monthEntryObjMap}
                    onCheckIn={handleDateCheckIn}
                    onUndo={handleDateUndo}
                    onSkip={handleDateSkip}
                    onFail={handleDateFail}
                    onClear={handleClearNonCompletion}
                  />
                ) : (
                  <Text fontSize="$1" color="$mutedForeground">
                    Tap a day to record, skip, or fix it.
                  </Text>
                )}
              </YStack>

              {/* ---- Recent entries ---- */}
              <YStack gap="$3">
                <Text fontSize="$3" fontWeight="600" color="$color">
                  Recent Entries
                </Text>
                {recentEntries.length === 0 ? (
                  <Text fontSize="$1" color="$mutedForeground">
                    No entries yet.
                  </Text>
                ) : (
                  <YStack gap="$1.5">
                    {recentEntries.map((entry) => (
                      <RecentEntryRow
                        key={entry.id}
                        entry={entry}
                        habit={habit}
                      />
                    ))}
                  </YStack>
                )}
              </YStack>
            </YStack>
          )}
        </ScrollView>
      </SafeAreaView>

      {habit && editOpen ? (
        <EditHabitDialog
          habit={habit}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </YStack>
  );
}

/* ------------------------------ Day cell ----------------------------------- */

function DayCell({
  date,
  isToday,
  today,
  selectedDate,
  dayMap,
  scheduledDays,
  isQuota,
}: {
  date: Date;
  isToday: boolean;
  today: string;
  selectedDate: string | null;
  dayMap: Map<string, { value: number; target: number; type?: string }>;
  scheduledDays?: number[] | null;
  isQuota: boolean;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  const d = dayMap.get(dateStr);
  const isFuture = dateStr > today;
  const isSelected = dateStr === selectedDate;
  const dow = date.getDay();
  const isScheduled = !scheduledDays?.length || scheduledDays.includes(dow);
  const isSkip = d?.type === "skip";
  const isExplicitFail = d?.type === "fail";
  const isComplete = !!d && !isSkip && !isExplicitFail && d.value >= d.target;
  const ratio = d && d.target > 0 ? Math.min(d.value / d.target, 1) : 0;
  const isPast = dateStr < today;
  const failed = !isQuota && (isExplicitFail || (isScheduled && isPast && !d));
  const partial = !isComplete && !failed && !isSkip && ratio > 0;

  // The month reads as the habit's ORANGE rhythm — IGNITION.habit stands in
  // for the web's --ring-habit vars.
  const bg = isComplete
    ? IGNITION.habit.base
    : failed
      ? "$destructiveMuted"
      : partial || isToday
        ? IGNITION.habit.track
        : isSelected
          ? "$accent"
          : "transparent";

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
        bg={bg as never}
        boxShadow={isComplete ? `0 0 8px ${IGNITION.habit.glow}` : undefined}
      >
        <Text
          fontSize={12}
          fontWeight={isComplete || isToday || isSelected ? "700" : "500"}
          color={(isComplete ? "#ffffff" : "$color") as never}
        >
          {date.getDate()}
        </Text>
      </View>
    </YStack>
  );
}

/* -------------------------- Selected-day panel ----------------------------- */

function DayActionPanel({
  selectedDate,
  today,
  habit,
  isQuota,
  isMutating,
  monthEntryMap,
  monthEntryObjMap,
  onCheckIn,
  onUndo,
  onSkip,
  onFail,
  onClear,
}: {
  selectedDate: string;
  today: string;
  habit: Habit;
  isQuota: boolean;
  isMutating: boolean;
  monthEntryMap: Map<string, { value: number; type?: string }>;
  monthEntryObjMap: Map<string, HabitEntry>;
  onCheckIn: (d: string) => void;
  onUndo: (d: string) => void;
  onSkip: (d: string) => void;
  onFail: (d: string) => void;
  onClear: (d: string) => void;
}) {
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
  const hasSchedule = habit.scheduledDays && habit.scheduledDays.length > 0;
  const selScheduled = !hasSchedule || habit.scheduledDays!.includes(selDow);

  return (
    <YStack
      rounded="$5"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$muted"
      px="$3"
      py="$2.5"
      gap="$2"
    >
      <XStack items="center" gap="$2">
        <Text fontSize="$2" fontWeight="600" color="$color">
          {format(parseDateLocal(selectedDate), "MMM d, yyyy")}
        </Text>
        <Text
          fontSize={11}
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
      <XStack items="center" flexWrap="wrap" gap="$1.5">
        {selValue > 0 && !selIsSkipped && !selIsFailed ? (
          <Button
            intent="outline"
            size="sm"
            icon={<Undo2 size={12} />}
            disabled={isMutating}
            onPress={() => onUndo(selectedDate)}
          >
            Undo
          </Button>
        ) : null}
        {selIsSkipped || selIsFailed ? (
          <Button
            intent="outline"
            size="sm"
            icon={<Undo2 size={12} />}
            disabled={isMutating}
            onPress={() => onClear(selectedDate)}
          >
            Undo {selIsFailed ? "fail" : "skip"}
          </Button>
        ) : null}
        {selIsFailed ? (
          <StatusChip
            icon={<X size={12} color="$destructive" />}
            label="Failed"
            bg="$destructiveMuted"
            color="$destructive"
          />
        ) : selIsSkipped ? (
          <StatusChip
            icon={<SkipForward size={12} color="$mutedForeground" />}
            label="Skipped"
            bg="$muted"
            color="$mutedForeground"
          />
        ) : selComplete ? (
          <StatusChip
            icon={<Check size={12} color="$success" />}
            label="Done"
            bg="$successMuted"
            color="$success"
          />
        ) : (
          <>
            {!isQuota && selScheduled && selectedDate <= today ? (
              <>
                <Button
                  intent="outline"
                  size="sm"
                  disabled={isMutating}
                  onPress={() => onSkip(selectedDate)}
                >
                  Skip
                </Button>
                <Button
                  intent="outline"
                  size="sm"
                  disabled={isMutating}
                  onPress={() => onFail(selectedDate)}
                >
                  Fail
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              disabled={isMutating}
              loading={isMutating}
              loadingText="…"
              onPress={() => onCheckIn(selectedDate)}
            >
              Record
            </Button>
          </>
        )}
      </XStack>
    </YStack>
  );
}

function StatusChip({
  icon,
  label,
  bg,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <XStack
      items="center"
      gap="$1"
      rounded="$3"
      bg={bg as never}
      px="$2.5"
      py="$1"
    >
      {icon}
      <Text fontSize="$1" fontWeight="500" color={color as never}>
        {label}
      </Text>
    </XStack>
  );
}

/* ----------------------------- Recent entry row ---------------------------- */

function RecentEntryRow({ entry, habit }: { entry: HabitEntry; habit: Habit }) {
  const dateStr = entry.date.split("T")[0]!;
  const entryIsSkip = entry.type === "skip";
  const entryIsFail = entry.type === "fail";
  const complete = isEntryComplete(entry, habit);

  return (
    <XStack
      items="center"
      justify="space-between"
      rounded="$5"
      borderWidth={1}
      borderColor="$borderColor"
      px="$3"
      py="$2"
      gap="$2"
    >
      <XStack items="center" gap="$2" flex={1} minW={0}>
        {entryIsFail ? (
          <X size={14} color="$destructive" />
        ) : entryIsSkip ? (
          <Minus size={14} color="$mutedForeground" />
        ) : complete ? (
          <Check size={14} color={"#22c55e" as never} />
        ) : (
          <View width={8} height={8} rounded={9999} bg={IGNITION.habit.base} />
        )}
        <Text fontSize="$3" color="$color">
          {format(parseDateLocal(dateStr), "MMM d, yyyy")}
        </Text>
      </XStack>
      <XStack items="center" gap="$2" shrink={0}>
        {entryIsFail ? (
          <Text fontSize="$1" fontWeight="500" color="$destructive">
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
        {entry.skipReason ? (
          <Text
            maxW={100}
            numberOfLines={1}
            fontSize="$1"
            color="$mutedForeground"
          >
            {entry.skipReason}
          </Text>
        ) : null}
      </XStack>
    </XStack>
  );
}
