// apps/mobile/app/(authed)/habits/[id].tsx
//
// Habit detail screen. Adapted from PWA's habit detail page
// (apps/pwa/app/app/habits/[id]/page.tsx):
//
//   - Header: back, icon, name, description, edit, delete
//   - 4 stat cards: Current Streak / Longest Streak / Total Completions /
//     Completion Rate (last 90 days)
//   - Navigable monthly calendar (dot per day, color-coded by ratio)
//   - Selected-date action panel — Record / Undo / Skip on any past or
//     today's date (future dates are non-interactive)
//   - Recent entries list (last 20)
//
// Math (current streak, longest streak, completion rate) reuses the same
// helpers as PWA via lib/habits.ts so all surfaces agree on the numbers.

import {
  Banner,
  Button,
  Card,
  IconButton,
  Paragraph,
  PullToRefresh,
  StreakBadge,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { HabitEntry } from "@repo/core/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EditHabitSheet } from "@/components/habits/EditHabitSheet";
import {
  useCheckInHabit,
  useDeleteHabit,
  useFailHabit,
  useHabit,
  useHabitEntries,
  useSkipHabit,
  useUpdateHabitEntry,
} from "@/lib/api";
import { resolveTargetCount } from "@/lib/habits";
import { computeStreak, fromDateKey, localDateKey } from "@/lib/streak";

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const haptic = useHaptic();
  const toast = useToast();

  const habitQuery = useHabit(id);
  const entriesQuery = useHabitEntries(id);
  const checkIn = useCheckInHabit();
  const updateEntry = useUpdateHabitEntry();
  const skipMutation = useSkipHabit();
  const failMutation = useFailHabit();
  const deleteHabit = useDeleteHabit();

  const [editOpen, setEditOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([habitQuery.refetch(), entriesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  const habit = habitQuery.data;
  const entries: HabitEntry[] = entriesQuery.data ?? [];

  // ---- Stats (90-day window matching PWA) ----
  const stats = useMemo(() => {
    if (!habit) return { streak: 0, longest: 0, total: 0, rate: 0 };

    const hasSchedule = !!habit.scheduledDays && habit.scheduledDays.length > 0;
    const today = new Date();

    // Build per-day aggregate map for the last 90 days.
    const dayMap = new Map<
      string,
      { value: number; type?: string; targetCountSnapshot?: number }
    >();
    for (const e of entries) {
      const k = e.date.slice(0, 10);
      const existing = dayMap.get(k);
      dayMap.set(k, {
        value: (existing?.value ?? 0) + e.value,
        type: e.type ?? existing?.type ?? "completion",
        targetCountSnapshot:
          existing?.targetCountSnapshot ?? e.targetCountSnapshot,
      });
    }

    const currentStreak = computeStreak(entries, habit.scheduledDays);

    let longest = 0;
    let temp = 0;
    let total = 0;
    for (let i = 90; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dow = d.getDay();
      if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;
      const k = localDateKey(d);
      const day = dayMap.get(k);
      if (day?.type === "skip") continue;
      // Explicit fail breaks the running streak just like a missed day.
      // (A past scheduled day with no entry also breaks below via the
      // value-check; this branch handles the "marked failed" case.)
      if (day?.type === "fail") {
        temp = 0;
        continue;
      }
      const tgt = resolveTargetCount(
        { targetCountSnapshot: day?.targetCountSnapshot },
        habit,
      );
      if ((day?.value ?? 0) >= tgt) {
        temp += 1;
        total += 1;
        longest = Math.max(longest, temp);
      } else {
        temp = 0;
      }
    }

    const daysWithData = dayMap.size;
    const rate =
      daysWithData > 0
        ? Math.round((total / Math.min(daysWithData + 10, 91)) * 100)
        : 0;

    return { streak: currentStreak, longest, total, rate };
  }, [entries, habit]);

  // ---- Calendar grid for the visible month ----
  const calendar = useMemo(() => {
    const monthStart = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    );
    const monthEnd = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
    );
    const days: Date[] = [];
    for (let i = 1; i <= monthEnd.getDate(); i++) {
      days.push(
        new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i),
      );
    }
    // Mon-start: convert Sun=0 to offset 6, Mon=1 to 0, ..., Sat=6 to 5.
    const startDow = monthStart.getDay();
    const offset = startDow === 0 ? 6 : startDow - 1;
    return { days, offset };
  }, [calendarMonth]);

  const recent = useMemo(() => {
    return entries
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [entries]);

  // ---- Day-level lookups for calendar + selected-date panel ----
  const dayMap = useMemo(() => {
    const m = new Map<
      string,
      { value: number; type?: string; entry?: HabitEntry; target: number }
    >();
    if (!habit) return m;
    for (const e of entries) {
      const k = e.date.slice(0, 10);
      const existing = m.get(k);
      const value = (existing?.value ?? 0) + e.value;
      const tgt = resolveTargetCount(
        { targetCountSnapshot: e.targetCountSnapshot },
        habit,
      );
      m.set(k, {
        value,
        type: e.type ?? existing?.type ?? "completion",
        entry: existing?.entry ?? e,
        target: tgt,
      });
    }
    return m;
  }, [entries, habit]);

  // ---- Actions ----

  function handleDelete() {
    if (!habit) return;
    Alert.alert(
      "Delete habit?",
      `"${habit.name}" and all entries will be removed permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            haptic.impact("medium");
            deleteHabit.mutate(habit.id, {
              onSuccess: () => router.back(),
              onError: () =>
                toast.show({
                  title: "Couldn't delete",
                  intent: "danger",
                }),
            });
          },
        },
      ],
    );
  }

  // Unified state machine for any date in the detail screen. Every action
  // chooses POST (no entry) vs PATCH (entry exists) — never DELETE — for
  // the same reason as the card: the Mongo per-(habit, date) unique index
  // doesn't filter soft-deleted ghosts. PATCH keeps the slot occupied while
  // letting type/value transition freely.
  type DateAction = "record" | "undo" | "skip" | "fail" | "clear";

  function handleDateAction(action: DateAction) {
    if (!habit || !selectedDate) return;
    const day = dayMap.get(selectedDate);
    haptic.impact("light");

    const onError = (verb: string) =>
      toast.show({ title: `Couldn't ${verb}`, intent: "danger" });

    if (action === "record") {
      const value = day?.value ?? 0;
      const tgt = day?.target ?? habit.targetCount ?? 1;
      const isNonCompletion = day?.type === "skip" || day?.type === "fail";
      if (!isNonCompletion && value >= tgt) {
        toast.show({ title: "Already complete", intent: "info" });
        return;
      }
      if (day?.entry) {
        // PATCH — promote skip/fail to completion(value=1), or increment.
        updateEntry.mutate(
          {
            habitId: habit.id,
            entryId: day.entry.id,
            patch: isNonCompletion
              ? { type: "completion", value: 1 }
              : { value: value + 1 },
          },
          { onError: () => onError("record") },
        );
      } else {
        checkIn.mutate(
          { habitId: habit.id, date: selectedDate, value: 1 },
          { onError: () => onError("record") },
        );
      }
      return;
    }

    if (action === "undo") {
      // Decrement value on a completion entry. Skip/fail use "clear" instead.
      if (
        !day?.entry ||
        day.value <= 0 ||
        day.type === "skip" ||
        day.type === "fail"
      )
        return;
      updateEntry.mutate(
        {
          habitId: habit.id,
          entryId: day.entry.id,
          patch: { value: day.value - 1 },
        },
        { onError: () => onError("undo") },
      );
      return;
    }

    if (action === "skip") {
      if (day?.type === "skip") return;
      if (day?.entry) {
        updateEntry.mutate(
          {
            habitId: habit.id,
            entryId: day.entry.id,
            patch: { type: "skip", value: 0 },
          },
          {
            onSuccess: () => toast.show({ title: "Skipped", intent: "info" }),
            onError: () => onError("skip"),
          },
        );
      } else {
        skipMutation.mutate(
          { habitId: habit.id, date: selectedDate },
          {
            onSuccess: () => toast.show({ title: "Skipped", intent: "info" }),
            onError: () => onError("skip"),
          },
        );
      }
      return;
    }

    if (action === "fail") {
      if (day?.type === "fail") return;
      haptic.impact("medium");
      if (day?.entry) {
        updateEntry.mutate(
          {
            habitId: habit.id,
            entryId: day.entry.id,
            patch: { type: "fail", value: 0 },
          },
          {
            onSuccess: () =>
              toast.show({
                title: "Marked failed",
                message: "Streak reset.",
                intent: "warning",
              }),
            onError: () => onError("mark failed"),
          },
        );
      } else {
        failMutation.mutate(
          { habitId: habit.id, date: selectedDate },
          {
            onSuccess: () =>
              toast.show({
                title: "Marked failed",
                message: "Streak reset.",
                intent: "warning",
              }),
            onError: () => onError("mark failed"),
          },
        );
      }
      return;
    }

    if (action === "clear") {
      // Convert a skip or fail back to completion(value=0). Same recovery
      // pattern as HabitCard.handleUndoSkip / handleUndoFail.
      if (!day?.entry || (day.type !== "skip" && day.type !== "fail")) return;
      updateEntry.mutate(
        {
          habitId: habit.id,
          entryId: day.entry.id,
          patch: { type: "completion", value: 0 },
        },
        { onError: () => onError("undo") },
      );
    }
  }

  // ---- Render ----

  if (habitQuery.isLoading) {
    return (
      <YStack flex={1} bg="$background" items="center" justify="center">
        <Paragraph color="$color11">Loading…</Paragraph>
      </YStack>
    );
  }

  if (!habit) {
    return (
      <YStack
        flex={1}
        bg="$background"
        items="center"
        justify="center"
        gap="$3"
      >
        <Paragraph color="$color12">Habit not found.</Paragraph>
        <Button intent="secondary" size="$3" onPress={() => router.back()}>
          Back
        </Button>
      </YStack>
    );
  }

  const habitColor = habit.color ?? "#3b82f6";
  const today = localDateKey();
  const selected = selectedDate ? dayMap.get(selectedDate) : null;

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          <YStack gap="$4" px="$5" pt="$3" pb="$8">
            {/* ---- Header ---- */}
            <XStack items="center" gap="$3">
              <IconButton
                size="$3"
                variant="ghost"
                onPress={() => router.back()}
                aria-label="Back"
              >
                <Text fontSize="$4" color="$color12">
                  ‹
                </Text>
              </IconButton>
              <View
                width={44}
                height={44}
                rounded={10}
                items="center"
                justify="center"
                bg={(habitColor + "33") as never}
              >
                <Text fontSize="$5">
                  {habit.icon ?? habit.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <YStack flex={1} gap={2}>
                <Text
                  fontSize="$5"
                  fontWeight="700"
                  color="$color12"
                  numberOfLines={1}
                >
                  {habit.name}
                </Text>
                {habit.description ? (
                  <Paragraph fontSize="$1" color="$color11" numberOfLines={1}>
                    {habit.description}
                  </Paragraph>
                ) : null}
              </YStack>
            </XStack>

            {/* ---- Stats ---- */}
            <XStack gap="$2" flexWrap="wrap">
              <StatCard label="Current streak" value={stats.streak} unit="d" />
              <StatCard label="Longest" value={stats.longest} unit="d" />
              <StatCard label="Total" value={stats.total} unit="" />
              <StatCard label="Completion rate" value={stats.rate} unit="%" />
            </XStack>

            {/* ---- Calendar ---- */}
            <Card>
              <Card.Header>
                <XStack items="center" justify="space-between">
                  <IconButton
                    size="$2"
                    variant="ghost"
                    onPress={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                    aria-label="Previous month"
                  >
                    <Text fontSize="$4" color="$color12">
                      ‹
                    </Text>
                  </IconButton>
                  <Text fontSize="$3" fontWeight="600" color="$color12">
                    {calendarMonth.toLocaleString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                  <IconButton
                    size="$2"
                    variant="ghost"
                    onPress={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                    aria-label="Next month"
                  >
                    <Text fontSize="$4" color="$color12">
                      ›
                    </Text>
                  </IconButton>
                </XStack>
              </Card.Header>
              <Card.Body gap="$2">
                {/* Weekday header */}
                <XStack gap={4} justify="space-between">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <View key={i} flex={1} items="center">
                      <Text
                        fontSize={10}
                        color="$color11"
                        fontWeight="600"
                        fontFamily="$mono"
                      >
                        {d}
                      </Text>
                    </View>
                  ))}
                </XStack>
                {/* Grid (6 rows × 7 cols, with leading offset) */}
                <CalendarGrid
                  calendar={calendar}
                  habit={habit}
                  dayMap={dayMap}
                  today={today}
                  selectedDate={selectedDate}
                  habitColor={habitColor}
                  onSelect={(d) =>
                    setSelectedDate((curr) => (curr === d ? null : d))
                  }
                />
              </Card.Body>
            </Card>

            {/* ---- Selected date action panel ---- */}
            {selected || selectedDate ? (
              <Card>
                <Card.Header>
                  <Text fontSize="$3" fontWeight="600" color="$color12">
                    {selectedDate
                      ? formatLong(fromDateKey(selectedDate))
                      : "Selected day"}
                  </Text>
                </Card.Header>
                <Card.Body gap="$2">
                  <Paragraph
                    fontSize="$2"
                    color={
                      (selected?.type === "fail"
                        ? "$red11"
                        : "$color11") as never
                    }
                  >
                    {selected?.type === "fail"
                      ? "Failed — streak reset"
                      : selected?.type === "skip"
                        ? "Skipped — streak preserved"
                        : `${selected?.value ?? 0}/${selected?.target ?? habit.targetCount ?? 1}`}
                  </Paragraph>
                  <XStack gap="$2" flexWrap="wrap">
                    {/* Skip/fail recovery: a single Undo pill that PATCHes the
                        entry back to completion(value=0), letting the user
                        Record again afterwards. */}
                    {selected?.type === "skip" || selected?.type === "fail" ? (
                      <ActionPill onPress={() => handleDateAction("clear")}>
                        Undo {selected?.type === "fail" ? "fail" : "skip"}
                      </ActionPill>
                    ) : (
                      <>
                        <ActionPill
                          onPress={() => handleDateAction("record")}
                          primary
                        >
                          Record
                        </ActionPill>
                        {selected && selected.value > 0 ? (
                          <ActionPill onPress={() => handleDateAction("undo")}>
                            Undo
                          </ActionPill>
                        ) : null}
                        {/* Skip + Fail offered when the day has no progress.
                            Hidden for partials to avoid accidental data loss
                            (Skip/Fail both zero the value). */}
                        {!selected || selected.value === 0 ? (
                          <>
                            <ActionPill
                              onPress={() => handleDateAction("skip")}
                            >
                              Skip
                            </ActionPill>
                            <ActionPill
                              onPress={() => handleDateAction("fail")}
                              tone="danger"
                            >
                              Fail
                            </ActionPill>
                          </>
                        ) : null}
                      </>
                    )}
                  </XStack>
                </Card.Body>
              </Card>
            ) : null}

            {/* ---- Recent entries ---- */}
            <YStack gap="$2">
              <Text
                fontSize={10}
                letterSpacing={1.6}
                textTransform="uppercase"
                color="$color11"
                fontWeight="600"
                fontFamily="$mono"
              >
                Recent entries
              </Text>
              {recent.length === 0 ? (
                <Paragraph fontSize="$2" color="$color11">
                  No entries yet.
                </Paragraph>
              ) : (
                recent.map((e) => (
                  <XStack
                    key={e.id}
                    items="center"
                    justify="space-between"
                    py="$2"
                    borderBottomWidth={1}
                    borderBottomColor="$color6"
                  >
                    <YStack gap={2}>
                      <Text fontSize="$2" color="$color12">
                        {formatShort(fromDateKey(e.date.slice(0, 10)))}
                      </Text>
                      {e.skipReason || e.notes ? (
                        <Text fontSize="$1" color="$color11">
                          {e.skipReason ?? e.notes}
                        </Text>
                      ) : null}
                    </YStack>
                    <Text
                      fontSize="$2"
                      fontWeight="600"
                      color={
                        (e.type === "fail"
                          ? "$red11"
                          : e.type === "skip"
                            ? "$color11"
                            : "$color12") as never
                      }
                      fontFamily="$mono"
                    >
                      {e.type === "fail"
                        ? "Fail"
                        : e.type === "skip"
                          ? "Skip"
                          : `${e.value}/${resolveTargetCount({ targetCountSnapshot: e.targetCountSnapshot }, habit)}`}
                    </Text>
                  </XStack>
                ))
              )}
            </YStack>

            {/* ---- Footer actions ---- */}
            <XStack gap="$2" pt="$2">
              <Button
                intent="secondary"
                size="$3"
                onPress={() => setEditOpen(true)}
                flex={1}
              >
                Edit
              </Button>
              <Button
                intent="destructive"
                size="$3"
                onPress={handleDelete}
                flex={1}
              >
                Delete
              </Button>
            </XStack>

            {entriesQuery.error ? (
              <Banner intent="danger">
                <Banner.Title>Couldn't load entries</Banner.Title>
                <Banner.Description>
                  {(entriesQuery.error as Error).message ?? "Network error."}
                </Banner.Description>
              </Banner>
            ) : null}
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      <EditHabitSheet
        habit={habit ?? null}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </YStack>
  );
}

// -------------------- Calendar grid sub-component --------------------

function CalendarGrid({
  calendar,
  habit,
  dayMap,
  today,
  selectedDate,
  habitColor,
  onSelect,
}: {
  calendar: { days: Date[]; offset: number };
  habit: { scheduledDays?: number[]; targetCount: number; createdAt?: string };
  dayMap: Map<string, { value: number; type?: string; target: number }>;
  today: string;
  selectedDate: string | null;
  habitColor: string;
  onSelect: (date: string) => void;
}) {
  const rows: (Date | null)[][] = [];
  let row: (Date | null)[] = Array.from({ length: calendar.offset }).map(
    () => null,
  );
  for (const d of calendar.days) {
    row.push(d);
    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }

  const hasSchedule = !!habit.scheduledDays && habit.scheduledDays.length > 0;
  // Clip auto-fail to days after the habit was created so a brand-new
  // habit doesn't render a sea of red dots.
  const habitCreatedKey = habit.createdAt
    ? localDateKey(new Date(habit.createdAt))
    : null;

  return (
    <YStack gap={4}>
      {rows.map((r, ri) => (
        <XStack key={ri} gap={4} justify="space-between">
          {r.map((d, di) => {
            if (!d) {
              return <View key={`empty-${ri}-${di}`} flex={1} height={36} />;
            }
            const dateStr = localDateKey(d);
            const isToday = dateStr === today;
            const isFuture = d > new Date() && !isToday;
            const isPast = !isFuture && !isToday;
            const dow = d.getDay();
            const scheduled =
              !hasSchedule || habit.scheduledDays!.includes(dow);
            const day = dayMap.get(dateStr);
            const isSelected = dateStr === selectedDate;
            const ratio =
              day && !isFuture
                ? day.target > 0
                  ? day.value / day.target
                  : 0
                : 0;
            const isSkip = day?.type === "skip";
            const isFail = day?.type === "fail";
            const isComplete = !isSkip && !isFail && ratio >= 1;
            const isPartial = !isSkip && !isFail && ratio > 0 && ratio < 1;
            const afterHabitCreation =
              !habitCreatedKey || dateStr >= habitCreatedKey;
            // Auto-fail: scheduled past day without any entry. Matches the
            // streak walk (which breaks at such a day) and the HabitCard
            // 30-day strip — keeps every surface telling the same story.
            const isAutoFail =
              !day && isPast && scheduled && afterHabitCreation;
            const isAnyFail = isFail || isAutoFail;

            const bg = isAnyFail
              ? "#dc2626" // red-600
              : isSkip
                ? "#94a3b8"
                : isComplete
                  ? habitColor
                  : isPartial
                    ? habitColor + "80"
                    : "transparent";

            return (
              <Pressable
                key={dateStr}
                onPress={() => onSelect(dateStr)}
                disabled={isFuture}
                style={{ flex: 1 }}
              >
                <View
                  height={36}
                  rounded={8}
                  items="center"
                  justify="center"
                  bg={bg as never}
                  borderWidth={isSelected ? 2 : isToday ? 1 : 0}
                  borderColor={
                    (isSelected
                      ? "$color12"
                      : isToday
                        ? "$color9"
                        : "transparent") as never
                  }
                  opacity={isFuture ? 0.3 : !scheduled ? 0.5 : 1}
                >
                  <Text
                    fontSize={11}
                    fontWeight={isToday ? "700" : "500"}
                    color={
                      (isComplete || isSkip || isAnyFail
                        ? "white"
                        : "$color12") as never
                    }
                  >
                    {d.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </XStack>
      ))}
    </YStack>
  );
}

// -------------------- Stat card --------------------

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <View
      flex={1}
      minWidth={144}
      rounded="$3"
      borderWidth={1}
      borderColor="$color6"
      bg="$color2"
      p="$3"
    >
      <YStack gap="$1">
        <Text
          fontSize={10}
          letterSpacing={1.6}
          textTransform="uppercase"
          color="$color11"
          fontWeight="600"
          fontFamily="$mono"
        >
          {label}
        </Text>
        <XStack items="baseline" gap={2}>
          <Text
            fontSize="$7"
            fontWeight="700"
            color="$color12"
            fontFamily="$mono"
          >
            {value}
          </Text>
          {unit ? (
            <Text fontSize="$2" color="$color11" fontFamily="$mono">
              {unit}
            </Text>
          ) : null}
        </XStack>
      </YStack>
    </View>
  );
}

function ActionPill({
  onPress,
  primary,
  tone,
  children,
}: {
  onPress: () => void;
  primary?: boolean;
  /** Semantic tint for non-primary pills. "danger" = red (used for Fail). */
  tone?: "danger";
  children: React.ReactNode;
}) {
  const bg = primary ? "$color9" : tone === "danger" ? "$red3" : "$color3";
  const borderColor = tone === "danger" && !primary ? "$red7" : "$color6";
  const textColor = primary
    ? "white"
    : tone === "danger"
      ? "$red11"
      : "$color12";
  return (
    <Pressable onPress={onPress}>
      <XStack
        px="$3"
        py="$2"
        rounded="$3"
        bg={bg as never}
        borderWidth={primary ? 0 : 1}
        borderColor={borderColor as never}
      >
        <Text fontSize="$2" fontWeight="600" color={textColor as never}>
          {children}
        </Text>
      </XStack>
    </Pressable>
  );
}

function formatLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
function formatShort(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Silence the unused-import warning for StreakBadge — kept for future use.
void StreakBadge;
