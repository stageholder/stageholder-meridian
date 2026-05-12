// apps/mobile/components/habits/HabitCard.tsx
//
// One habit's daily card. Mirrors PWA's HabitCard
// (apps/pwa/components/habits/habit-card.tsx) — same affordance set,
// mobile-native shell:
//
//   - ProgressRing visualizes value / target
//   - When NOT complete: action buttons — Skip, Undo, Check-in / +
//   - When complete: strikethrough name + Undo button
//   - Tap the row body → /habits/[id] detail screen
//   - Long-press or ⋯ → Alert with Edit / Delete
//
// Streak math, value/target resolution, and entry merging come from
// lib/habits.ts so the numbers agree with PWA + Today dashboard exactly.

import {
  Card,
  Heatmap,
  IconButton,
  Paragraph,
  ProgressRing,
  StreakBadge,
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
import { Alert, Pressable, ScrollView } from "react-native";

import { EmberBurst } from "@/components/EmberBurst";
import {
  useCheckInHabit,
  useDeleteHabit,
  useHabitEntries,
  useSkipHabit,
  useUpdateHabitEntry,
} from "@/lib/api";
import { resolveDayProgress, resolveTargetCount } from "@/lib/habits";
import { computeStreak, isScheduledToday, localDateKey } from "@/lib/streak";

const DEFAULT_COLOR = "#a855f7";

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
  const isComplete = !isSkipped && value >= target;
  const scheduledToday = isScheduledToday(habit.scheduledDays);
  const streak = computeStreak(entries, habit.scheduledDays);
  const color = habit.color ?? DEFAULT_COLOR;

  // Tier-up toast: only fires when streak increases.
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

  // Last 30 days of consistency for the mini-heatmap.
  const heat = useMemo<{ date: Date; value: number }[]>(() => {
    if (!entries) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return entries
      .filter(
        (e) => e.type !== "skip" && e.value > 0 && new Date(e.date) >= cutoff,
      )
      .map((e) => ({ date: new Date(e.date), value: 1 }));
  }, [entries]);

  // ---- Actions ----

  function handleCheckIn() {
    if (!scheduledToday) {
      haptic.impact("light");
      return;
    }
    if (isComplete) {
      haptic.impact("light");
      return;
    }
    haptic.notification("success");
    setBurstAt(Date.now());
    checkIn.mutate(
      { habitId: habit.id, date: today, value: 1 },
      {
        onError: () =>
          toast.show({
            title: "Couldn't check in",
            message: "Reverted. Tap to retry.",
            intent: "danger",
          }),
      },
    );
  }

  function handleSkip() {
    if (isComplete || isSkipped || !scheduledToday || value > 0) return;
    haptic.impact("light");
    skip.mutate(
      { habitId: habit.id, date: today },
      {
        onSuccess: () =>
          toast.show({
            title: `Skipped ${habit.name}`,
            intent: "info",
          }),
        onError: () =>
          toast.show({
            title: "Couldn't skip",
            intent: "danger",
          }),
      },
    );
  }

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
        onError: () =>
          toast.show({
            title: "Couldn't undo",
            intent: "danger",
          }),
      },
    );
  }

  function openActions() {
    Alert.alert(habit.name, undefined, [
      { text: "Edit", onPress: () => onEdit?.(habit) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Delete habit?",
            `"${habit.name}" and all its entries will be removed permanently.`,
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

  const stateLabel = !scheduledToday
    ? "Off-day"
    : isSkipped
      ? "Skipped today"
      : isComplete
        ? `Done · ${value}/${target}`
        : value > 0
          ? `${value}/${target}`
          : target > 1
            ? "Tap + to log progress"
            : "Tap the ring to check in";

  return (
    <Card>
      <Card.Body gap="$3">
        <XStack items="center" gap="$3">
          {/* Ring — primary check-in (target=1) / completion visual (>1) */}
          <Pressable onPress={handleCheckIn}>
            <View>
              <ProgressRing
                value={value}
                max={Math.max(1, target)}
                size={56}
                thickness={6}
                fillColor={color}
              >
                <Text
                  fontSize={target > 1 ? 14 : 20}
                  color={(isComplete ? color : "$color10") as never}
                  fontWeight="700"
                >
                  {isComplete ? "✓" : target > 1 ? `${value}` : ""}
                </Text>
              </ProgressRing>
              <EmberBurst trigger={burstAt} color={color} x={28} y={28} />
            </View>
          </Pressable>

          {/* Name + state — tap to navigate to detail screen, long-press → actions */}
          <Pressable
            style={{ flex: 1 }}
            // Cast — expo-router's typed routes haven't picked up the new
            // /habits/[id].tsx file yet; the runtime resolves it fine.
            onPress={() => router.push(`/habits/${habit.id}` as never)}
            onLongPress={openActions}
            delayLongPress={400}
          >
            <YStack gap={3}>
              <Text
                fontSize="$3"
                color="$color12"
                fontWeight="600"
                numberOfLines={1}
                style={
                  isComplete
                    ? { textDecorationLine: "line-through" }
                    : undefined
                }
              >
                {habit.icon ? `${habit.icon} ` : ""}
                {habit.name}
              </Text>
              <XStack items="center" gap="$2">
                {streak > 0 ? <StreakBadge count={streak} size="$2" /> : null}
                <Paragraph fontSize="$1" color="$color11">
                  {stateLabel}
                </Paragraph>
              </XStack>
            </YStack>
          </Pressable>

          {/* Overflow menu */}
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

        {/* Action row — Skip / Undo / + appear only when meaningful */}
        {scheduledToday && !isSkipped ? (
          <XStack gap="$2">
            {!isComplete && value === 0 ? (
              <ActionPill onPress={handleSkip}>Skip</ActionPill>
            ) : null}
            {value > 0 ? (
              <ActionPill onPress={handleUndo}>Undo</ActionPill>
            ) : null}
            {!isComplete && target > 1 ? (
              <ActionPill primary onPress={handleCheckIn}>
                + 1{habit.unit ? ` ${habit.unit}` : ""}
              </ActionPill>
            ) : null}
            {!isComplete && target === 1 && value === 0 ? (
              <ActionPill primary onPress={handleCheckIn}>
                Check in
              </ActionPill>
            ) : null}
          </XStack>
        ) : null}

        {/* Last 30 days of consistency */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Heatmap
            data={heat}
            cellSize={10}
            gap={2}
            cellVariant="dot"
            showMonthLabels={false}
            startDate={(() => {
              const d = new Date();
              d.setDate(d.getDate() - 29);
              return d;
            })()}
            endDate={new Date()}
            renderCell={({ value }) => (
              <View
                width={10}
                height={10}
                rounded={5}
                bg={(value > 0 ? color : "$color5") as never}
              />
            )}
          />
        </ScrollView>
      </Card.Body>
    </Card>
  );
}

function ActionPill({
  onPress,
  disabled,
  primary,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <XStack
        px="$3"
        py="$1.5"
        rounded="$3"
        bg={(primary ? "$color9" : "$color3") as never}
        borderWidth={primary ? 0 : 1}
        borderColor="$color6"
        opacity={disabled ? 0.4 : 1}
      >
        <Text
          fontSize="$2"
          fontWeight="600"
          color={(primary ? "white" : "$color12") as never}
        >
          {children}
        </Text>
      </XStack>
    </Pressable>
  );
}
