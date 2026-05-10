// apps/mobile/components/habits/HabitCard.tsx
//
// One habit's daily card. Tap the ProgressRing to check in (or undo).
// Streak shows tier-up celebration via toast on the way up; ember-burst
// fires when crossing 7 days. Mini-heatmap below shows the last 30 days.

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
import { useMemo, useState } from "react";
import { Pressable, ScrollView } from "react-native";

import { EmberBurst } from "@/components/EmberBurst";
import { useHabits } from "@/lib/stores/habits";
import { dateKey, type Habit } from "@/lib/types";

export type HabitCardProps = { habit: Habit };

export function HabitCard({ habit }: HabitCardProps) {
  const { toggleCheckIn, isCheckedIn, streakFor } = useHabits();
  const haptic = useHaptic();
  const toast = useToast();
  const [burstAt, setBurstAt] = useState<number | null>(null);

  const today = dateKey();
  const todayDow = new Date().getDay();
  const scheduledToday =
    habit.scheduledDays.length === 0 || habit.scheduledDays.includes(todayDow);

  const checked = isCheckedIn(habit.id, today);
  const streak = streakFor(habit.id);

  // Heatmap data — last 30 days, value=1 when checked in.
  const heat = useMemo(() => {
    const out: { date: Date; value: number }[] = [];
    const t = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(t);
      d.setDate(d.getDate() - i);
      const k = dateKey(d);
      if (habit.checkIns[k]) out.push({ date: d, value: 1 });
    }
    return out;
  }, [habit.checkIns]);

  function tierLabel(n: number): string | null {
    if (n === 3) return "3-day streak";
    if (n === 7) return "1-week streak";
    if (n === 14) return "2-week streak";
    if (n === 30) return "1-month streak";
    if (n === 100) return "100-day streak";
    return null;
  }

  function handleCheckIn() {
    if (!scheduledToday) {
      haptic.impact("light");
      return;
    }
    if (!checked) {
      // Going from unchecked → checked.
      haptic.notification("success");
      const nextStreak = streak + 1;
      const tier = tierLabel(nextStreak);
      if (tier) {
        toast.show({
          title: `${tier} 🔥`,
          message: `${habit.title} — keep it going.`,
          intent: "success",
        });
      }
      setBurstAt(Date.now());
    } else {
      haptic.impact("light");
    }
    toggleCheckIn(habit.id, today);
  }

  return (
    <Card>
      <Card.Body gap="$3">
        <XStack items="center" gap="$3">
          {/* The ring is the tap target — big finger area. We pass a custom
              fillColor so it matches this habit's identity. */}
          <Pressable onPress={handleCheckIn}>
            <View>
              <ProgressRing
                value={checked ? 1 : 0}
                max={1}
                size={56}
                thickness={6}
                fillColor={habit.color}
              >
                <Text
                  fontSize={20}
                  color={(checked ? habit.color : "$color10") as never}
                  fontWeight="700"
                >
                  {checked ? "✓" : ""}
                </Text>
              </ProgressRing>
              <EmberBurst trigger={burstAt} color={habit.color} x={28} y={28} />
            </View>
          </Pressable>

          <YStack flex={1} gap={3}>
            <Text
              fontSize="$3"
              color="$color12"
              fontWeight="600"
              numberOfLines={1}
            >
              {habit.title}
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

        {/* Last 30 days as colored dots — quick read of recent consistency */}
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
                bg={(value > 0 ? habit.color : "$color5") as never}
              />
            )}
          />
        </ScrollView>
      </Card.Body>
    </Card>
  );
}
