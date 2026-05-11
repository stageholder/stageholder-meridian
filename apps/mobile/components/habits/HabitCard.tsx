// apps/mobile/components/habits/HabitCard.tsx
//
// One habit's daily card. Tap the ProgressRing to check in (or no-op when
// already checked — server enforces idempotency, we just save the round
// trip). Streak comes from useHabitEntries + computeStreak. Mini-heatmap
// below shows the last 30 days from the same entries.
//
// Tier-up celebration (3 / 7 / 14 / 30 / 100 days) fires on the way up
// only — we snapshot the previous streak so a refresh doesn't re-fire.

import {
  Card,
  Heatmap,
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
import type { Habit } from "@repo/core/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView } from "react-native";

import { EmberBurst } from "@/components/EmberBurst";
import { useCheckInHabit, useHabitEntries } from "@/lib/api";
import {
  computeStreak,
  isCheckedToday,
  isScheduledToday,
  localDateKey,
} from "@/lib/streak";

export type HabitCardProps = { habit: Habit };

const DEFAULT_COLOR = "#a855f7";

function tierLabel(n: number): string | null {
  if (n === 3) return "3-day streak";
  if (n === 7) return "1-week streak";
  if (n === 14) return "2-week streak";
  if (n === 30) return "1-month streak";
  if (n === 100) return "100-day streak";
  return null;
}

export function HabitCard({ habit }: HabitCardProps) {
  const entriesQuery = useHabitEntries(habit.id);
  const checkIn = useCheckInHabit();
  const haptic = useHaptic();
  const toast = useToast();
  const [burstAt, setBurstAt] = useState<number | null>(null);

  const entries = entriesQuery.data;
  const scheduledToday = isScheduledToday(habit.scheduledDays);
  const checked = isCheckedToday(entries);
  const streak = computeStreak(entries, habit.scheduledDays);
  const color = habit.color ?? DEFAULT_COLOR;

  // Fire tier toast only when streak crosses upward (not on initial load
  // or refetch returning the same number).
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

  // Heatmap data — last 30 days, value=1 per entry that's not a skip.
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

  function handleCheckIn() {
    if (!scheduledToday) {
      haptic.impact("light");
      return;
    }
    if (checked) {
      // Already done — gentle ack, no server hit.
      haptic.impact("light");
      return;
    }
    haptic.notification("success");
    setBurstAt(Date.now());
    checkIn.mutate(
      { habitId: habit.id, date: localDateKey() },
      {
        onError: () => {
          toast.show({
            title: "Couldn't check in",
            message: "Reverted. Tap to retry.",
            intent: "danger",
          });
        },
      },
    );
  }

  return (
    <Card>
      <Card.Body gap="$3">
        <XStack items="center" gap="$3">
          {/* The ring is the tap target — big finger area. */}
          <Pressable onPress={handleCheckIn}>
            <View>
              <ProgressRing
                value={checked ? 1 : 0}
                max={1}
                size={56}
                thickness={6}
                fillColor={color}
              >
                <Text
                  fontSize={20}
                  color={(checked ? color : "$color10") as never}
                  fontWeight="700"
                >
                  {checked ? "✓" : ""}
                </Text>
              </ProgressRing>
              <EmberBurst trigger={burstAt} color={color} x={28} y={28} />
            </View>
          </Pressable>

          <YStack flex={1} gap={3}>
            <Text
              fontSize="$3"
              color="$color12"
              fontWeight="600"
              numberOfLines={1}
            >
              {habit.name}
            </Text>
            <XStack items="center" gap="$2">
              {streak > 0 ? (
                <StreakBadge count={streak} size="$2" />
              ) : (
                <Text fontSize="$1" color="$color11">
                  No streak yet
                </Text>
              )}
              <Paragraph fontSize="$1" color="$color11">
                {!scheduledToday
                  ? "Off-day"
                  : checked
                    ? "Done today"
                    : "Tap the ring to check in"}
              </Paragraph>
            </XStack>
          </YStack>
        </XStack>

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
