// apps/mobile/components/habits/HabitCard.tsx
//
// Gamified habit card — the streak is the hero, the week pattern is
// the second voice, the action button is the bottom bass note.
//
// Layout (top to bottom):
//   1. Habit-color top stripe (3pt) — wordless brand identity per habit
//   2. Header row: icon · name · streak fire · overflow
//   3. State line: "Done today · 1/1" or "Tap to check in"
//   4. WEEK strip — 7 dots labeled S–M–T–W–T–F–S, filled per check-in
//   5. 30-DAY heatmap — single horizontal row of squares
//   6. Action row: Skip · Undo · Check-in (whichever apply)
//
// All densities tuned so a four-line phone screen can show 3–4 cards
// without scrolling. The card itself is NOT the tap target — that was
// the previous design's flaw; it conflicts with long-press for the
// overflow menu and with vertical scrolling. The Check-in button is
// the dominant action, and a separate "open detail" gesture comes
// from tapping the name area.
//
// Streak math, value/target resolution, and per-day rollup come from
// lib/habits.ts so the numbers agree with PWA + Today dashboard.

import {
  Card,
  IconButton,
  Paragraph,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { Habit, HabitEntry } from "@repo/core/types";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable } from "react-native";
import Animated from "react-native-reanimated";

import {
  HabitFireBurst,
  useTilePulse,
} from "@/components/habits/HabitFireBurst";
import {
  extractServerMessage,
  useCheckInHabit,
  useDeleteHabit,
  useFailHabit,
  useHabitEntries,
  useSkipHabit,
  useUpdateHabitEntry,
} from "@/lib/api";
import {
  resolveDayProgress,
  resolveTargetCount,
  type DayProgress,
} from "@/lib/habits";
import {
  computeStreak,
  fromDateKey,
  isScheduledToday,
  localDateKey,
} from "@/lib/streak";

const DEFAULT_COLOR = "#a855f7";
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function tierLabel(n: number): string | null {
  if (n === 3) return "3-day streak";
  if (n === 7) return "1-week streak";
  if (n === 14) return "2-week streak";
  if (n === 30) return "1-month streak";
  if (n === 100) return "100-day streak";
  return null;
}

export type HabitCardProps = {
  habit: Habit;
  /** Open the edit sheet for this habit (parent owns the sheet). */
  onEdit?: (habit: Habit) => void;
};

export function HabitCard({ habit, onEdit }: HabitCardProps) {
  const router = useRouter();
  const haptic = useHaptic();
  const toast = useToast();
  const entriesQuery = useHabitEntries(habit.id);
  const checkIn = useCheckInHabit();
  const skip = useSkipHabit();
  const failHabit = useFailHabit();
  const updateEntry = useUpdateHabitEntry();
  const deleteHabit = useDeleteHabit();
  const [burstAt, setBurstAt] = useState<number | null>(null);

  const today = localDateKey();
  const entries = entriesQuery.data;
  const todayProgress = resolveDayProgress(entries, today);
  const todayEntry = useMemo<HabitEntry | undefined>(
    () => entries?.find((e) => e.date === today),
    [entries, today],
  );

  const target = resolveTargetCount(
    { targetCountSnapshot: todayProgress?.targetCountSnapshot },
    habit,
  );
  const value = todayProgress?.value ?? 0;
  const isSkipped = todayProgress?.type === "skip";
  const isFailed = todayProgress?.type === "fail";
  const isComplete = !isSkipped && !isFailed && value >= target;
  const scheduledToday = isScheduledToday(habit.scheduledDays);
  const streak = computeStreak(entries, habit.scheduledDays);
  const color = habit.color ?? DEFAULT_COLOR;
  // Used to clip "past scheduled day with no entry → auto-fail" to days
  // after the habit was created. Otherwise a brand-new habit would render
  // 30 red dots in the 30-day strip on day one.
  const habitCreatedDateKey = useMemo(
    () => (habit.createdAt ? localDateKey(new Date(habit.createdAt)) : null),
    [habit.createdAt],
  );

  // Tile pulse — kick-and-settle spring driven by the burst trigger.
  // Lives at the card level so the tile, fire burst, and shockwave all
  // sync to the same instant.
  const tilePulse = useTilePulse(burstAt);

  // Tier-up toast — only fires when the streak crosses a milestone, not
  // on refetch returning a stable number.
  const prevStreakRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = streak;
    if (prev == null) return;
    if (streak > prev) {
      const t = tierLabel(streak);
      if (t) {
        toast.show({
          title: `${t} 🔥`,
          message: `${habit.name} — keep it going.`,
          intent: "success",
        });
      }
    }
  }, [streak, habit.name, toast]);

  // ---- Per-day rollups for the visualizations ----

  // This week's day-by-day status (S→S). State precedence (highest first):
  //   failed  — explicit fail entry, OR past scheduled day with no entry
  //             (after habit creation); breaks the streak
  //   skipped — explicit skip; preserves the streak
  //   done    — value >= target
  //   partial — value > 0 (and < target)
  //   today   — the cell is today and no outcome yet (open)
  //   future  — date is in the future
  //   offday  — past day, not in the habit's scheduled days
  const weekDays = useMemo(() => {
    const out: {
      key: string;
      label: string;
      state:
        | "done"
        | "partial"
        | "skipped"
        | "failed"
        | "today"
        | "future"
        | "offday";
    }[] = [];
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const key = localDateKey(d);
      const isFuture = d > now && key !== today;
      const isPast = !isFuture && key !== today;
      const isScheduled = isScheduledToday(habit.scheduledDays, d);
      const afterHabitCreation =
        !habitCreatedDateKey || key >= habitCreatedDateKey;
      const prog = resolveDayProgress(entries, key);
      let state: (typeof out)[number]["state"] = "today";
      if (isFuture) state = "future";
      else if (prog?.type === "fail") state = "failed";
      else if (prog?.type === "skip") state = "skipped";
      else if (prog && prog.value >= target) state = "done";
      else if (prog && prog.value > 0) state = "partial";
      else if (isPast && isScheduled && afterHabitCreation) state = "failed";
      else if (isPast) state = "offday";
      else if (key === today) state = "today";
      out.push({ key, label: WEEKDAY_LABELS[i]!, state });
    }
    return out;
  }, [entries, target, today, habit.scheduledDays, habitCreatedDateKey]);

  // Last 30 days for the bottom strip. Same state machine as weekDays —
  // 'failed' covers both explicit fails and auto-failed past scheduled days.
  const monthDays = useMemo(() => {
    const out: {
      key: string;
      state: "done" | "partial" | "skipped" | "failed" | "today" | "offday";
    }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = localDateKey(d);
      const isPast = key !== today;
      const isScheduled = isScheduledToday(habit.scheduledDays, d);
      const afterHabitCreation =
        !habitCreatedDateKey || key >= habitCreatedDateKey;
      const prog = resolveDayProgress(entries, key);
      let state: (typeof out)[number]["state"] = "today";
      if (prog?.type === "fail") state = "failed";
      else if (prog?.type === "skip") state = "skipped";
      else if (prog && prog.value >= target) state = "done";
      else if (prog && prog.value > 0) state = "partial";
      else if (isPast && isScheduled && afterHabitCreation) state = "failed";
      else if (isPast) state = "offday";
      out.push({ key, state });
    }
    return out;
  }, [entries, target, today, habit.scheduledDays, habitCreatedDateKey]);

  // Completion rate over the 30-day window — drives the small headline %.
  // Skipped days are excluded from the denominator (they're "off the books").
  // Failed days count against the user.
  const monthRate = useMemo(() => {
    const total = monthDays.filter(
      (d) =>
        d.state !== "skipped" && d.state !== "offday" && d.state !== "today",
    ).length;
    if (total === 0) return 0;
    const done = monthDays.filter((d) => d.state === "done").length;
    return Math.round((done / total) * 100);
  }, [monthDays]);

  // ---- Action handlers ----

  // Every handler must decide POST (no entry yet) vs PATCH (an entry exists
  // for today — skip, fail, partial, or finished). Never DELETE: the Mongo
  // unique index on (userSub, habit_id, date) is NOT partial on deleted_at,
  // so a soft-deleted ghost still occupies the slot and any subsequent POST
  // for the same date 500s with E11000. Aligns with the PWA's contract that
  // once an entry exists for a date, it stays — only its `type`/`value`
  // change. A value-0 completion entry reads identically to "no entry" in
  // the streak walk and the rollups.
  function handleCheckIn() {
    if (!scheduledToday || isComplete) {
      haptic.impact("light");
      return;
    }
    haptic.notification("success");
    setBurstAt(Date.now());

    if (todayEntry) {
      // Promote skip/fail → completion(value=1) or increment a partial.
      const nextValue =
        todayEntry.type === "skip" || todayEntry.type === "fail"
          ? 1
          : Math.min((todayEntry.value ?? 0) + 1, Math.max(target, 1));
      updateEntry.mutate(
        {
          habitId: habit.id,
          entryId: todayEntry.id,
          patch: { type: "completion", value: nextValue },
        },
        {
          onError: (err) =>
            toast.show({
              title: "Couldn't check in",
              message:
                extractServerMessage(err) ??
                (err as Error).message ??
                "Reverted. Tap to retry.",
              intent: "danger",
            }),
        },
      );
      return;
    }

    checkIn.mutate(
      { habitId: habit.id, date: today, value: 1 },
      {
        onError: (err) =>
          toast.show({
            title: "Couldn't check in",
            message:
              extractServerMessage(err) ??
              (err as Error).message ??
              "Reverted. Tap to retry.",
            intent: "danger",
          }),
      },
    );
  }

  function handleSkip() {
    if (isComplete || isSkipped || !scheduledToday) return;
    haptic.impact("light");

    if (todayEntry) {
      updateEntry.mutate(
        {
          habitId: habit.id,
          entryId: todayEntry.id,
          patch: { type: "skip", value: 0 },
        },
        {
          onSuccess: () =>
            toast.show({ title: `Skipped ${habit.name}`, intent: "info" }),
          onError: () =>
            toast.show({ title: "Couldn't skip", intent: "danger" }),
        },
      );
      return;
    }

    skip.mutate(
      { habitId: habit.id, date: today },
      {
        onSuccess: () =>
          toast.show({ title: `Skipped ${habit.name}`, intent: "info" }),
        onError: () => toast.show({ title: "Couldn't skip", intent: "danger" }),
      },
    );
  }

  function handleFail() {
    if (isFailed || !scheduledToday) return;
    haptic.impact("medium");

    if (todayEntry) {
      updateEntry.mutate(
        {
          habitId: habit.id,
          entryId: todayEntry.id,
          patch: { type: "fail", value: 0 },
        },
        {
          onSuccess: () =>
            toast.show({
              title: `Marked ${habit.name} as failed`,
              message: "Streak reset.",
              intent: "warning",
            }),
          onError: () =>
            toast.show({ title: "Couldn't mark as failed", intent: "danger" }),
        },
      );
      return;
    }

    failHabit.mutate(
      { habitId: habit.id, date: today },
      {
        onSuccess: () =>
          toast.show({
            title: `Marked ${habit.name} as failed`,
            message: "Streak reset.",
            intent: "warning",
          }),
        onError: () =>
          toast.show({ title: "Couldn't mark as failed", intent: "danger" }),
      },
    );
  }

  // Undo decrement a completion's value. Even when the value reaches 0, we
  // leave the entry in place (type=completion, value=0) — this reads as
  // "open" everywhere in the UI and to the streak walk, but keeps the row
  // in the DB so subsequent Check in / Skip / Fail can PATCH rather than
  // POST. The PWA's handleUndo does the same.
  function handleUndo() {
    if (!todayEntry || todayEntry.value <= 0) return;
    haptic.impact("light");
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: todayEntry.id,
        patch: { value: todayEntry.value - 1 },
      },
      {
        onError: () => toast.show({ title: "Couldn't undo", intent: "danger" }),
      },
    );
  }

  // Undo a skip — PATCH the type back to completion with value=0. The entry
  // stays; the day reads as fresh-open everywhere. We never DELETE because
  // (see top-of-section comment) the Mongo unique-key slot would still be
  // occupied by a soft-deleted ghost and the next POST would E11000.
  function handleUndoSkip() {
    if (!todayEntry || todayEntry.type !== "skip") return;
    haptic.impact("light");
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: todayEntry.id,
        patch: { type: "completion", value: 0 },
      },
      {
        onError: () =>
          toast.show({ title: "Couldn't undo skip", intent: "danger" }),
      },
    );
  }

  // Symmetric with handleUndoSkip — PATCH type back to completion(value=0).
  function handleUndoFail() {
    if (!todayEntry || todayEntry.type !== "fail") return;
    haptic.impact("light");
    updateEntry.mutate(
      {
        habitId: habit.id,
        entryId: todayEntry.id,
        patch: { type: "completion", value: 0 },
      },
      {
        onError: () => toast.show({ title: "Couldn't undo", intent: "danger" }),
      },
    );
  }

  function openActions() {
    Alert.alert(habit.name, undefined, [
      {
        text: "Open detail",
        onPress: () => router.push(`/habits/${habit.id}` as never),
      },
      { text: "Edit", onPress: () => onEdit?.(habit) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
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
                    onError: () =>
                      toast.show({
                        title: "Couldn't delete",
                        intent: "danger",
                      }),
                  });
                },
              },
            ],
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  // ---- Header bits ----

  const stateLabel = !scheduledToday
    ? "Off-day"
    : isFailed
      ? "Failed today"
      : isSkipped
        ? "Skipped today"
        : isComplete
          ? `Done today · ${value}/${target}`
          : value > 0
            ? `${value}/${target} today`
            : target > 1
              ? `0/${target} today · tap + to log`
              : "Not done today";

  // ---- Render ----

  return (
    <Card overflow="hidden" position="relative">
      {/* Card-wide ignition overlay — covers the whole card with absolute
          positioning + pointerEvents='none'. Particles rise from the
          bottom edge, the card gets a warm tint wash, the border halos.
          All driven by the same `burstAt` trigger the icon pulse uses. */}
      <HabitFireBurst trigger={burstAt} color={color} />

      {/* Habit-color top stripe — 3pt brand identity slot. Glow-bright when
          complete, dimmed when scheduled-but-open, slate when off-day. */}
      <View
        height={3}
        bg={
          (isComplete
            ? color
            : !scheduledToday
              ? "$color6"
              : color + "60") as never
        }
      />

      <Card.Body gap="$3" py="$3">
        {/* ── HEADER ROW: icon · name + state · streak · overflow ─────── */}
        <XStack items="center" gap="$3">
          <Pressable
            onPress={() => router.push(`/habits/${habit.id}` as never)}
            onLongPress={openActions}
            delayLongPress={400}
          >
            {/* Animated.View carries the spring overshoot pulse on each
                check-in (useTilePulse above). The View inside is the
                static tile chrome — its bg + border color reflect
                completion state without animating, so the pulse
                doesn't fight a color transition. */}
            <Animated.View style={tilePulse}>
              <View
                width={44}
                height={44}
                rounded={12}
                items="center"
                justify="center"
                bg={(isComplete ? color : color + "22") as never}
                borderWidth={isComplete ? 0 : 1}
                borderColor={(color + "55") as never}
              >
                {/* Icon priority:
                    1. User-set habit.icon (emoji)        — e.g. "💧", "🏃"
                    2. Done state: ✓                      — visual reward
                    3. Default: ✦ (four-point star)       — observatory
                       theme; every habit is a star to be lit
                    First-letter fallback was dropped — it never felt
                    intentional and clashed with the gamified frame. */}
                <Text
                  fontSize={habit.icon ? 22 : 18}
                  color={(isComplete ? "white" : color) as never}
                  fontWeight="700"
                >
                  {habit.icon ?? (isComplete ? "✓" : "✦")}
                </Text>
              </View>
            </Animated.View>
          </Pressable>

          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push(`/habits/${habit.id}` as never)}
            onLongPress={openActions}
            delayLongPress={400}
          >
            <YStack gap={2}>
              <Text
                fontSize="$4"
                fontWeight="700"
                color="$color12"
                numberOfLines={1}
              >
                {habit.name}
              </Text>
              <Paragraph fontSize="$1" color="$color11" numberOfLines={1}>
                {stateLabel}
                {habit.description ? ` · ${habit.description}` : ""}
              </Paragraph>
            </YStack>
          </Pressable>

          {/* Streak fire — only shown when there's a streak to flex.
              When zero, the space is left for the action buttons to
              breathe. Uppercase + monospace makes it feel like a stat
              readout. */}
          {streak > 0 ? (
            <XStack
              items="center"
              gap={4}
              px="$2"
              py={4 as never}
              rounded="$2"
              bg={(color + "1a") as never}
              borderWidth={1}
              borderColor={(color + "33") as never}
            >
              <Text fontSize={14}>🔥</Text>
              <Text
                fontSize={11}
                fontFamily="$mono"
                fontWeight="700"
                color={color as never}
                letterSpacing={0.5 as never}
              >
                {streak}
              </Text>
            </XStack>
          ) : null}

          <IconButton
            size="$2"
            variant="ghost"
            onPress={openActions}
            aria-label="Habit options"
          >
            <Text fontSize="$3" color="$color11">
              ⋯
            </Text>
          </IconButton>
        </XStack>

        {/* ── WEEK STRIP ───────────────────────────────────────────────── */}
        <YStack gap={6}>
          <XStack items="center" justify="space-between">
            <Text
              fontSize={10}
              letterSpacing={1.4}
              textTransform="uppercase"
              color="$color11"
              fontWeight="600"
              fontFamily="$mono"
            >
              This week
            </Text>
            <Text fontSize={10} color="$color11" fontFamily="$mono">
              {monthRate}% · 30 day
            </Text>
          </XStack>
          <XStack gap={4} justify="space-between">
            {weekDays.map((d, i) => (
              <YStack key={d.key} flex={1} items="center" gap={3}>
                <Text
                  fontSize={9}
                  color={(d.key === today ? color : "$color11") as never}
                  fontFamily="$mono"
                  fontWeight="600"
                >
                  {d.label}
                </Text>
                <View
                  width={"100%" as never}
                  height={8}
                  rounded={4}
                  bg={
                    (d.state === "done"
                      ? color
                      : d.state === "partial"
                        ? color + "80"
                        : d.state === "failed"
                          ? "$red9"
                          : d.state === "skipped"
                            ? "$color5"
                            : d.state === "today"
                              ? color + "33"
                              : d.state === "future"
                                ? "$color3"
                                : "$color3") as never
                  }
                  borderWidth={d.key === today ? 1 : 0}
                  borderColor={color as never}
                />
              </YStack>
            ))}
          </XStack>
        </YStack>

        {/* ── 30-DAY STRIP ────────────────────────────────────────────── */}
        <YStack gap={6}>
          <Text
            fontSize={10}
            letterSpacing={1.4}
            textTransform="uppercase"
            color="$color11"
            fontWeight="600"
            fontFamily="$mono"
          >
            Last 30 days
          </Text>
          <XStack gap={2} justify="space-between">
            {monthDays.map((d, i) => (
              <View
                key={d.key}
                flex={1}
                height={6}
                rounded={3}
                bg={
                  (d.state === "done"
                    ? color
                    : d.state === "partial"
                      ? color + "70"
                      : d.state === "failed"
                        ? "$red9"
                        : d.state === "skipped"
                          ? "$color5"
                          : "$color3") as never
                }
              />
            ))}
          </XStack>
        </YStack>

        {/* ── ACTION ROW ────────────────────────────────────────────────
            Four states, mutually exclusive:
              · Off-day  → "Rest day" hint, no actions.
              · Skipped  → "Undo skip".
              · Failed   → "Undo fail".
              · Scheduled & open → Skip · Fail · Undo · Check in.
            All Undo/Skip/Fail/CheckIn handlers PATCH when an entry exists
            and POST when it doesn't — never DELETE. (See handler comments.)
        */}
        {!scheduledToday ? (
          <Text fontSize="$1" color="$color10" pt="$1">
            Rest day — not scheduled.
          </Text>
        ) : isSkipped ? (
          <XStack items="center" gap="$2" pt="$1">
            <Text fontSize="$1" color="$color11" flex={1}>
              Skipped today — streak preserved.
            </Text>
            <ActionPill onPress={handleUndoSkip}>Undo skip</ActionPill>
          </XStack>
        ) : isFailed ? (
          <XStack items="center" gap="$2" pt="$1">
            <Text fontSize="$1" color="$red11" flex={1}>
              Failed today — streak reset.
            </Text>
            <ActionPill onPress={handleUndoFail}>Undo</ActionPill>
          </XStack>
        ) : (
          <XStack gap="$2" pt="$1" items="center">
            {!isComplete && value === 0 ? (
              <>
                <ActionPill onPress={handleSkip}>Skip</ActionPill>
                <ActionPill onPress={handleFail} tone="danger">
                  Fail
                </ActionPill>
              </>
            ) : null}
            {value > 0 ? (
              <ActionPill onPress={handleUndo}>Undo</ActionPill>
            ) : null}
            <View flex={1} />
            {!isComplete ? (
              <ActionPill primary color={color} onPress={handleCheckIn}>
                {target > 1
                  ? `+ 1${habit.unit ? ` ${habit.unit}` : ""}`
                  : "Check in"}
              </ActionPill>
            ) : (
              <XStack
                items="center"
                gap="$1.5"
                px="$3"
                py="$2"
                rounded="$3"
                bg={(color + "1a") as never}
                borderWidth={1}
                borderColor={(color + "44") as never}
              >
                <Text fontSize="$2" fontWeight="700" color={color as never}>
                  ✓ Done
                </Text>
              </XStack>
            )}
          </XStack>
        )}
      </Card.Body>
    </Card>
  );
}

function ActionPill({
  onPress,
  disabled,
  primary,
  color,
  tone,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  /** When primary, the pill fills with this color. Defaults to brand $color9. */
  color?: string;
  /** Optional semantic tint for non-primary pills (e.g. "danger" for Fail). */
  tone?: "danger";
  children: React.ReactNode;
}) {
  const bg = primary
    ? (color ?? "$color9")
    : tone === "danger"
      ? "$red3"
      : "$color3";
  const borderColor =
    tone === "danger" && !primary ? ("$red7" as const) : ("$color6" as const);
  const textColor = primary
    ? "white"
    : tone === "danger"
      ? "$red11"
      : "$color12";
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <XStack
        px="$3"
        py="$2"
        rounded="$3"
        bg={bg as never}
        borderWidth={primary ? 0 : 1}
        borderColor={borderColor as never}
        opacity={disabled ? 0.4 : 1}
        items="center"
        gap={4}
      >
        <Text fontSize="$2" fontWeight="700" color={textColor as never}>
          {children}
        </Text>
      </XStack>
    </Pressable>
  );
}

// Silence unused-import warnings for `fromDateKey` (kept for downstream
// utilities) and the DayProgress type re-export ceremony.
void fromDateKey;
void (null as DayProgress | null);
