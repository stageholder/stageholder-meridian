import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Dashboard, Text, View, YStack } from "@stageholder/ui";
import { useUserLight } from "@/lib/api/light";
import { LevelUpCelebration } from "@repo/features/light";
import { DashboardStats } from "@repo/features/dashboard";
import { useLevelUp } from "@/lib/hooks/use-level-up";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { GreetingBar } from "@/components/dashboard/greeting-bar";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { TodayTodos } from "@/components/dashboard/today-todos";
import { HabitSummary } from "@/components/dashboard/habit-summary";
import { WeeklyActivityChart } from "@/components/dashboard/charts/weekly-activity-chart";
import { JournalGrowthChart } from "@/components/dashboard/charts/journal-growth-chart";
import { LightEarnedChart } from "@/components/dashboard/charts/light-earned-chart";
import { WritingHeatmap } from "@/components/dashboard/charts/writing-heatmap";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

/** The kit-styled "View all" widget action — a TanStack Link. */
function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <Text
        fontSize="$1"
        color="$primary"
        hoverStyle={{ textDecorationLine: "underline" }}
      >
        View all
      </Text>
    </Link>
  );
}

/**
 * Motivation-first dashboard on the kit `Dashboard` grid: a full-width hero
 * (rings + level) leads, then an at-a-glance `Stat` KPI row, the action pair
 * (todos + habits), and the trend charts. Every cell is a kit `Dashboard.Widget`
 * (responsive 12-col grid on web, stacks on narrow); the widgets own the card
 * chrome + titles, and the shared feature views render only their content.
 */
function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: userLight } = useUserLight();
  const { levelUpTier, dismiss } = useLevelUp(userLight);
  const stats = useDashboardStats(userLight);

  return (
    <YStack gap="$4" p="$4" $lg={{ p: "$5" }}>
      {/* Greeting — full width, above the grid. */}
      <View enterStyle={{ opacity: 0, y: 12 }} transition="medium">
        <GreetingBar />
      </View>

      <Dashboard columns={12} gap="$4">
        {/* Hero — motivation centerpiece: activity rings + level progress. */}
        <Dashboard.Widget colSpan={12} hideHeader>
          <DashboardHero date={today} userLight={userLight} />
        </Dashboard.Widget>

        {/* KPI row — chromeless full-width cell; the Stat tiles carry their own
            card borders. */}
        <Dashboard.Widget colSpan={12} hideHeader bordered={false} flush>
          <DashboardStats stats={stats} />
        </Dashboard.Widget>

        {/* Action pair — todos + habits, equal halves (stack on narrow). */}
        <Dashboard.Widget
          colSpan={6}
          title="Today's Todos"
          actions={<ViewAll to="/todos" />}
        >
          <TodayTodos />
        </Dashboard.Widget>
        <Dashboard.Widget
          colSpan={6}
          title="Habits Today"
          actions={<ViewAll to="/habits" />}
        >
          <HabitSummary />
        </Dashboard.Widget>

        {/* Journal pair — growth trend beside its GitHub-style word-count
            heatmap (both journal-yellow). The heatmap scrolls horizontally in
            the half-width cell. */}
        <Dashboard.Widget colSpan={6} title="Journal Growth">
          <JournalGrowthChart />
        </Dashboard.Widget>
        <Dashboard.Widget colSpan={6} title="Writing Activity">
          <WritingHeatmap />
        </Dashboard.Widget>

        {/* Activity pair — weekly activity beside light growth (both gapped
            histograms). */}
        <Dashboard.Widget colSpan={6} title="Weekly Activity">
          <WeeklyActivityChart />
        </Dashboard.Widget>
        <Dashboard.Widget colSpan={6} title="Light Growth">
          <LightEarnedChart />
        </Dashboard.Widget>
      </Dashboard>

      {levelUpTier ? (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      ) : null}
    </YStack>
  );
}
