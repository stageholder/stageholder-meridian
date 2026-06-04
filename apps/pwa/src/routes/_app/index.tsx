import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { View, XStack, YStack } from "@stageholder/ui";
import {
  ActivityRings,
  ActivityRingsBreakdown,
} from "@/components/activity-rings";
import { useUserLight } from "@/lib/api/light";
import { LevelProgress, LevelUpCelebration } from "@repo/features/light";
import { useLevelUp } from "@/lib/hooks/use-level-up";
import { GreetingBar } from "@/components/dashboard/greeting-bar";
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
    // Stack-based dashboard: a vertical column of rows. The two paired rows lay
    // their cards side-by-side (5/7 split) from $md up and stack on phones.
    // Tamagui is flexbox-only, so this is plain XStack/YStack — no CSS grid.
    <YStack gap="$4" p="$4" $lg={{ p: "$5" }}>
      {/* Greeting — full width. Tamagui native staggered mount fade. */}
      <View enterStyle={{ opacity: 0, y: 12 }} transition="medium">
        <GreetingBar />
      </View>

      {/* Daily progress + weekly activity. Left column stacks two cards:
          the overview (combined rings + level) and the per-category
          breakdown. They stack under the weekly chart on phones. */}
      <YStack gap="$4" $md={{ flexDirection: "row" }}>
        <View $md={{ flex: 5 }}>
          <YStack gap="$4">
            {/* Overview — combined rings (centered) + level progress. */}
            <BentoCard index={1}>
              <Link
                to="/journey"
                style={{ display: "block", textDecoration: "none" }}
              >
                {/* The bare ring is content-width; center it in the card. */}
                <XStack justify="center">
                  <ActivityRings date={today} size="xl" bare />
                </XStack>
                {userLight ? (
                  // LevelProgress owns no margin (its only prop is `userLight`);
                  // space it from the rings with a Tamagui margin wrapper.
                  <View mt="$5">
                    <LevelProgress userLight={userLight} />
                  </View>
                ) : null}
              </Link>
            </BentoCard>

            {/* Breakdown — one row per category, ring on the trailing edge. */}
            <BentoCard index={2}>
              <Link
                to="/journey"
                style={{ display: "block", textDecoration: "none" }}
              >
                <ActivityRingsBreakdown date={today} />
              </Link>
            </BentoCard>
          </YStack>
        </View>
        <View $md={{ flex: 7 }}>
          <BentoCard title="Weekly Activity" index={3}>
            <WeeklyActivityChart />
          </BentoCard>
        </View>
      </YStack>

      {/* Today's todos + habit summary */}
      <YStack gap="$4" $md={{ flexDirection: "row" }}>
        <View $md={{ flex: 5 }}>
          <TodayTodos index={4} />
        </View>
        <View $md={{ flex: 7 }}>
          <HabitSummary index={5} />
        </View>
      </YStack>

      {/* Journal growth — full width */}
      <BentoCard title="Journal Growth" index={6}>
        <JournalGrowthChart />
      </BentoCard>

      {/* Light growth — full width */}
      <BentoCard title="Light Growth" index={7}>
        <LightEarnedChart />
      </BentoCard>

      {levelUpTier ? (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      ) : null}
    </YStack>
  );
}
