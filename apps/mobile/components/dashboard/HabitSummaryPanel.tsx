// apps/mobile/components/dashboard/HabitSummaryPanel.tsx
//
// Inline panel for the Today dashboard. Mirrors PWA's HabitSummary
// (apps/pwa/components/dashboard/habit-summary.tsx):
//   - Top 5 habits, scheduled-today first, with value/target progress bar
//   - "Rest day" badge for off-day habits
//   - "Skipped" badge for skipped entries
//   - Strike-through name when complete
//
// Differences vs PWA panel:
//   - No "View all" link in the header chrome — the tap target is the
//     entire panel body, since on mobile tap-to-navigate is the dominant
//     pattern (no hover affordance).
//   - Per-habit value comes from each habit's entries query (already in
//     cache from useTodayHabitProgress) — same data, no extra round trip.

import {
  Card,
  Paragraph,
  Progress,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { Habit, HabitEntry } from "@repo/core/types";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable } from "react-native";

import { apiClient, habitKeys, useHabits } from "@/lib/api";
import { resolveDayProgress, resolveTargetCount } from "@/lib/habits";
import { isScheduledToday, localDateKey } from "@/lib/streak";

const MAX_VISIBLE = 5;

export function HabitSummaryPanel() {
  const habitsQuery = useHabits();
  const router = useRouter();
  const habits: Habit[] = habitsQuery.data ?? [];

  // Fan out: per-habit entries. Cached by useTodayHabitProgress already,
  // so this is a no-op refetch under the same query keys.
  const entriesQueries = useQueries({
    queries: habits.map((h) => ({
      queryKey: habitKeys.entries(h.id),
      queryFn: async () => {
        const { data } = await apiClient.get<
          { data: HabitEntry[] } | HabitEntry[]
        >(`/habits/${h.id}/entries`);
        return Array.isArray(data) ? data : data.data;
      },
    })),
  });

  const today = localDateKey();
  const isLoading =
    habitsQuery.isLoading || entriesQueries.some((q) => q.isLoading);

  const rows = useMemo(() => {
    return habits
      .map((habit, i) => {
        const entries = entriesQueries[i]?.data;
        const progress = resolveDayProgress(entries, today);
        const scheduled = isScheduledToday(habit.scheduledDays);
        return { habit, progress, scheduled };
      })
      .sort((a, b) => {
        // Scheduled-and-not-done first; rest at the bottom.
        const aRank = a.scheduled ? ((a.progress?.value ?? 0) > 0 ? 1 : 0) : 2;
        const bRank = b.scheduled ? ((b.progress?.value ?? 0) > 0 ? 1 : 0) : 2;
        return aRank - bRank;
      })
      .slice(0, MAX_VISIBLE);
  }, [habits, entriesQueries, today]);

  const scheduledToday = habits.filter((h) =>
    isScheduledToday(h.scheduledDays),
  ).length;

  return (
    <Card>
      <Card.Header>
        <XStack items="center" justify="space-between">
          <YStack gap="$1">
            <Paragraph
              fontFamily="$mono"
              fontSize={10}
              letterSpacing={1.6}
              textTransform="uppercase"
              color="$color11"
              fontWeight="600"
            >
              {scheduledToday === 0
                ? "No habits"
                : `${scheduledToday} scheduled`}
            </Paragraph>
            <Paragraph fontSize="$3" color="$color12" fontWeight="500">
              Habits today
            </Paragraph>
          </YStack>
          <Pressable onPress={() => router.push("/habits")}>
            <Text fontSize="$1" color="$color11" fontWeight="500">
              View all ›
            </Text>
          </Pressable>
        </XStack>
      </Card.Header>
      <Card.Body gap="$3">
        {isLoading ? (
          <Paragraph fontSize="$2" color="$color11" py="$2">
            Loading…
          </Paragraph>
        ) : habits.length === 0 ? (
          <Paragraph fontSize="$2" color="$color11" py="$2">
            No habits to track yet.
          </Paragraph>
        ) : (
          rows.map(({ habit, progress, scheduled }) => {
            // Rest day — habit isn't scheduled today, render dim and short.
            if (!scheduled) {
              return (
                <XStack key={habit.id} items="center" justify="space-between">
                  <Text
                    fontSize="$2"
                    color="$color10"
                    numberOfLines={1}
                    flex={1}
                  >
                    {habit.name}
                  </Text>
                  <Text fontSize={10} color="$color10">
                    Rest day
                  </Text>
                </XStack>
              );
            }

            // Skipped — explicit skip entry on today's date.
            if (progress?.type === "skip") {
              return (
                <XStack key={habit.id} items="center" justify="space-between">
                  <Text
                    fontSize="$2"
                    color="$color10"
                    numberOfLines={1}
                    flex={1}
                  >
                    {habit.name}
                  </Text>
                  <Text fontSize={10} color="$color10">
                    Skipped
                  </Text>
                </XStack>
              );
            }

            const value = progress?.value ?? 0;
            const target = resolveTargetCount(
              { targetCountSnapshot: progress?.targetCountSnapshot },
              habit,
            );
            const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
            const isComplete = value >= target;
            const barColor = isComplete
              ? "#22c55e"
              : (habit.color ?? "#f97316");

            return (
              <YStack key={habit.id} gap="$1.5">
                <XStack items="center" justify="space-between">
                  <Text
                    fontSize="$2"
                    color={(isComplete ? "$color10" : "$color12") as never}
                    numberOfLines={1}
                    flex={1}
                    style={
                      isComplete
                        ? { textDecorationLine: "line-through" }
                        : undefined
                    }
                  >
                    {habit.name}
                  </Text>
                  <Text fontSize={10} color="$color11" fontFamily="$mono">
                    {value}/{target}
                  </Text>
                </XStack>
                <Progress value={pct}>
                  <Progress.Indicator bg={barColor as never} />
                </Progress>
              </YStack>
            );
          })
        )}
      </Card.Body>
    </Card>
  );
}
