"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActivityRings } from "@/components/activity-rings";
import { useUserLight } from "@/lib/api/light";
import { LevelProgress } from "@/components/light/level-progress";
import { LevelUpCelebration } from "@/components/light/level-up-celebration";
import { useLevelUp } from "@/lib/hooks/use-level-up";
import { GreetingBar } from "@/components/dashboard/greeting-bar";
import { BentoCard } from "@/components/dashboard/bento-card";
import { TodayTodos } from "@/components/dashboard/today-todos";
import { HabitSummary } from "@/components/dashboard/habit-summary";
import { RecentJournals } from "@/components/dashboard/recent-journals";
import { WeeklyActivityChart } from "@/components/dashboard/charts/weekly-activity-chart";
import { MoodTrendChart } from "@/components/dashboard/charts/mood-trend-chart";
import { LightEarnedChart } from "@/components/dashboard/charts/light-earned-chart";

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const params = useParams<{ shortId: string }>();
  const { data: userLight } = useUserLight();
  const { levelUpTier, dismiss } = useLevelUp(userLight);

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-12 lg:p-6">
      {/* Row 1: Greeting */}
      <div className="col-span-full animate-[bento-enter_0.4s_ease-out_both]">
        <GreetingBar />
      </div>

      {/* Row 2: Activity Rings + Level | Weekly Activity Chart */}
      <BentoCard index={1} className="md:col-span-1 lg:col-span-5">
        <Link href={`/${params.shortId}/journey`} className="block">
          <ActivityRings date={today} size="xl" showLabels bare />
          {userLight && (
            <LevelProgress userLight={userLight} className="mt-4" />
          )}
        </Link>
      </BentoCard>

      <BentoCard
        title="Weekly Activity"
        index={2}
        className="md:col-span-1 lg:col-span-7"
      >
        <WeeklyActivityChart />
      </BentoCard>

      {/* Row 3: Today's Todos | Habit Summary */}
      <TodayTodos index={3} className="md:col-span-1 lg:col-span-5" />
      <HabitSummary index={4} className="md:col-span-1 lg:col-span-7" />

      {/* Row 4: Mood Trend | Light Earned */}
      <BentoCard
        title="Mood Trend"
        index={5}
        className="md:col-span-1 lg:col-span-5"
      >
        <MoodTrendChart />
      </BentoCard>

      <BentoCard
        title="Light Earned"
        index={6}
        className="md:col-span-1 lg:col-span-7"
      >
        <LightEarnedChart />
      </BentoCard>

      {/* Row 5: Recent Journals */}
      <RecentJournals index={7} className="col-span-full" />

      {levelUpTier && (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      )}
    </div>
  );
}
