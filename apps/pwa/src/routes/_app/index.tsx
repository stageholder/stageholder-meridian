import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { View, YStack } from "@stageholder/ui";
import { useUserLight } from "@/lib/api/light";
import { LevelUpCelebration } from "@repo/features/light";
import { useLevelUp } from "@/lib/hooks/use-level-up";
import { GreetingBar } from "@/components/dashboard/greeting-bar";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { BentoCard } from "@repo/features/dashboard";
import { TodayTodos } from "@/components/dashboard/today-todos";
import { HabitSummary } from "@/components/dashboard/habit-summary";
import { WeeklyActivityChart } from "@/components/dashboard/charts/weekly-activity-chart";
import { JournalGrowthChart } from "@/components/dashboard/charts/journal-growth-chart";
import { LightEarnedChart } from "@/components/dashboard/charts/light-earned-chart";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: userLight } = useUserLight();
  const { levelUpTier, dismiss } = useLevelUp(userLight);

  return (
    // Motivation-first dashboard: a full-width hero (rings + level + breakdown)
    // leads, then everything else is laid out as same-height PAIRS so no card
    // is ever stretched against a taller neighbor (the old empty-space bug).
    // Tamagui is flexbox-only — plain XStack/YStack, no CSS grid.
    <YStack gap="$4" p="$4" $lg={{ p: "$5" }}>
      {/* Greeting — full width. Tamagui native staggered mount fade. */}
      <View enterStyle={{ opacity: 0, y: 12 }} transition="medium">
        <GreetingBar />
      </View>

      {/* Hero — full width: combined rings + Light/level + category breakdown. */}
      <DashboardHero date={today} userLight={userLight} />

      {/* Action pair — equal 1:1 columns; `fill` stretches both to one height
          so the shorter list doesn't leave a gap under its partner. */}
      <YStack gap="$4" $md={{ flexDirection: "row" }}>
        <View $md={{ flex: 1 }}>
          <TodayTodos index={2} fill />
        </View>
        <View $md={{ flex: 1 }}>
          <HabitSummary index={3} fill />
        </View>
      </YStack>

      {/* Weekly Activity — full width (a 7-day timeline reads best wide). */}
      <BentoCard title="Weekly Activity" index={4}>
        <WeeklyActivityChart />
      </BentoCard>

      {/* Growth charts — equal 1:1 pair (both are 200px, so naturally level). */}
      <YStack gap="$4" $md={{ flexDirection: "row" }}>
        <View $md={{ flex: 1 }}>
          <BentoCard title="Journal Growth" index={5} fill>
            <JournalGrowthChart />
          </BentoCard>
        </View>
        <View $md={{ flex: 1 }}>
          <BentoCard title="Light Growth" index={6} fill>
            <LightEarnedChart />
          </BentoCard>
        </View>
      </YStack>

      {levelUpTier ? (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      ) : null}
    </YStack>
  );
}
