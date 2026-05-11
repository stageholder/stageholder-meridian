// apps/mobile/app/(authed)/habits.tsx
//
// Live Habits screen. List of HabitCards (each one self-loads its entries
// for streak math), sorted scheduled-today + unchecked first. Pull-to-
// refresh re-fetches the habit list (entry caches stay warm).

import {
  Banner,
  Button,
  EmptyState,
  FAB,
  H3,
  Paragraph,
  PullToRefresh,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { Habit } from "@repo/core/types";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddHabitSheet } from "@/components/habits/AddHabitSheet";
import { HabitCard } from "@/components/habits/HabitCard";
import { useHabits } from "@/lib/api";
import { isScheduledToday } from "@/lib/streak";

export default function HabitsScreen() {
  const habitsQuery = useHabits();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await habitsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const habits = habitsQuery.data ?? [];

  // Scheduled-today first; within that, the order the server returned.
  // We don't sort by "checked today" here because HabitCard owns the
  // entries query — pulling that into a parent sort would require
  // ANOTHER round-trip per habit just for ordering. Not worth it.
  const sorted = useMemo(() => {
    return [...habits].sort((a, b) => {
      const aSched = isScheduledToday(a.scheduledDays);
      const bSched = isScheduledToday(b.scheduledDays);
      if (aSched !== bSched) return aSched ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [habits]);

  const scheduledTodayCount = useMemo(
    () => habits.filter((h) => isScheduledToday(h.scheduledDays)).length,
    [habits],
  );

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          <YStack gap="$4" px="$5" pt="$4" pb={96}>
            <YStack gap="$1">
              <Paragraph
                fontFamily="$mono"
                fontSize={11}
                letterSpacing={2}
                textTransform="uppercase"
                color="$color11"
              >
                {scheduledTodayCount === 0
                  ? "No habits yet"
                  : `${scheduledTodayCount} scheduled today`}
              </Paragraph>
              <H3 color="$color12">Habits</H3>
            </YStack>

            {habitsQuery.error ? (
              <Banner intent="danger">
                <Banner.Title>Couldn't load habits</Banner.Title>
                <Banner.Description>
                  {(habitsQuery.error as Error).message ?? "Network error."}
                </Banner.Description>
                <XStack pt="$2">
                  <Button intent="secondary" size="$2" onPress={handleRefresh}>
                    Try again
                  </Button>
                </XStack>
              </Banner>
            ) : null}

            {!habitsQuery.error && habits.length === 0 ? (
              <EmptyState>
                <EmptyState.IconSlot>
                  <Text fontSize={24}>◎</Text>
                </EmptyState.IconSlot>
                <EmptyState.Title>
                  {habitsQuery.isLoading ? "Loading…" : "No habits yet"}
                </EmptyState.Title>
                <EmptyState.Description>
                  Add a daily ritual you want to keep — a walk, a few pages, ten
                  minutes of stillness. The streak takes care of itself.
                </EmptyState.Description>
                <EmptyState.Actions>
                  <Button onPress={() => setSheetOpen(true)}>
                    Add first habit
                  </Button>
                </EmptyState.Actions>
              </EmptyState>
            ) : (
              sorted.map((h: Habit) => <HabitCard key={h.id} habit={h} />)
            )}
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      <FAB
        icon={
          <Text color="white" fontSize={28} fontWeight="300" lineHeight={28}>
            +
          </Text>
        }
        placement="bottom-right"
        b={88}
        onPress={() => setSheetOpen(true)}
      />

      <AddHabitSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </YStack>
  );
}
