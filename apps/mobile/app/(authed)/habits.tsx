// apps/mobile/app/(authed)/habits.tsx
//
// Full Habits screen. Shows scheduled-today first, then non-today, then
// off-day habits. Tap a ring to check in; FAB → AddHabitSheet for new ones.

import {
  Button,
  EmptyState,
  FAB,
  H3,
  Paragraph,
  Text,
  YStack,
} from "@stageholder/ui";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddHabitSheet } from "@/components/habits/AddHabitSheet";
import { HabitCard } from "@/components/habits/HabitCard";
import { useHabits } from "@/lib/stores/habits";
import { dateKey } from "@/lib/types";

export default function HabitsScreen() {
  const { habits, add } = useHabits();
  const [sheetOpen, setSheetOpen] = useState(false);

  const sorted = useMemo(() => {
    const todayDow = new Date().getDay();
    const today = dateKey();
    return [...habits].sort((a, b) => {
      const aSched =
        a.scheduledDays.length === 0 || a.scheduledDays.includes(todayDow);
      const bSched =
        b.scheduledDays.length === 0 || b.scheduledDays.includes(todayDow);
      // Scheduled today first.
      if (aSched !== bSched) return aSched ? -1 : 1;
      // Within scheduled-today: unchecked before checked (so "what's left" is on top).
      if (aSched && bSched) {
        const aDone = !!a.checkIns[today];
        const bDone = !!b.checkIns[today];
        if (aDone !== bDone) return aDone ? 1 : -1;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [habits]);

  const todayProgress = useMemo(() => {
    const today = dateKey();
    const todayDow = new Date().getDay();
    const scheduled = habits.filter(
      (h) => h.scheduledDays.length === 0 || h.scheduledDays.includes(todayDow),
    );
    const done = scheduled.filter((h) => h.checkIns[today]).length;
    return { done, total: scheduled.length };
  }, [habits]);

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          <YStack gap="$4" pt="$4">
            <YStack gap="$1">
              <Paragraph
                fontFamily="$mono"
                fontSize={11}
                letterSpacing={2}
                textTransform="uppercase"
                color="$color11"
              >
                {todayProgress.done} of {todayProgress.total} today
              </Paragraph>
              <H3 color="$color12">Habits</H3>
            </YStack>

            {habits.length === 0 ? (
              <EmptyState>
                <EmptyState.IconSlot>
                  <Text fontSize={24}>◎</Text>
                </EmptyState.IconSlot>
                <EmptyState.Title>No habits yet</EmptyState.Title>
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
              sorted.map((h) => <HabitCard key={h.id} habit={h} />)
            )}
          </YStack>
        </ScrollView>
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

      <AddHabitSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={(input) => add(input)}
      />
    </YStack>
  );
}
