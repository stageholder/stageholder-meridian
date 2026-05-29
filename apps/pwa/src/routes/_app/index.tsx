import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { View, YStack } from "@stageholder/ui";
import { ActivityRings } from "@/components/activity-rings";
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

      {/* Activity rings + weekly activity */}
      <YStack gap="$4" $md={{ flexDirection: "row" }}>
        <View $md={{ flex: 5 }}>
          <BentoCard index={1}>
            <Link
              to="/journey"
              style={{ display: "block", textDecoration: "none" }}
            >
              <ActivityRings date={today} size="xl" showLabels bare />
              {userLight ? (
                <LevelProgress userLight={userLight} className="mt-4" />
              ) : null}
            </Link>
          </BentoCard>
        </View>
        <View $md={{ flex: 7 }}>
          <BentoCard title="Weekly Activity" index={2}>
            <WeeklyActivityChart />
          </BentoCard>
        </View>
      </YStack>

      {/* Today's todos + habit summary */}
      <YStack gap="$4" $md={{ flexDirection: "row" }}>
        <View $md={{ flex: 5 }}>
          <TodayTodos index={3} />
        </View>
        <View $md={{ flex: 7 }}>
          <HabitSummary index={4} />
        </View>
      </YStack>

      {/* Journal growth — full width */}
      <BentoCard title="Journal Growth" index={5}>
        <JournalGrowthChart />
      </BentoCard>

      {/* Light growth — full width */}
      <BentoCard title="Light Growth" index={6}>
        <LightEarnedChart />
      </BentoCard>

      {levelUpTier ? (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      ) : null}
    </YStack>
  );
}
