"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActivityRings } from "@/components/activity-rings";
import { useUserLight } from "@/lib/api/light";
import { LevelProgress } from "@/components/light/level-progress";
import { LevelUpCelebration } from "@/components/light/level-up-celebration";
import { useLevelUp } from "@/lib/hooks/use-level-up";
import { TodayTodos } from "@/components/dashboard/today-todos";
import { HabitSummary } from "@/components/dashboard/habit-summary";
import { RecentJournals } from "@/components/dashboard/recent-journals";

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const params = useParams<{ shortId: string }>();
  const { data: userLight } = useUserLight();
  const { levelUpTier, dismiss } = useLevelUp(userLight);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal productivity overview.
        </p>
      </div>

      <Link href={`/${params.shortId}/journey`}>
        <ActivityRings date={today} size="xl" showLabels />
        {userLight && <LevelProgress userLight={userLight} className="mt-4" />}
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <TodayTodos />
        <HabitSummary />
      </div>

      <RecentJournals />

      {levelUpTier && <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />}
    </div>
  );
}
