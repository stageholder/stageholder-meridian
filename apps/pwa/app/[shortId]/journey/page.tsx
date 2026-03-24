"use client";

import { format } from "date-fns";
import { useUserLight } from "@/lib/api/light";
import { ActivityRings } from "@/components/activity-rings";
import { StarVisual } from "@/components/light/star-visual";
import { LevelProgress } from "@/components/light/level-progress";
import { LevelUpCelebration } from "@/components/light/level-up-celebration";
import { useLevelUp } from "@/lib/hooks/use-level-up";
import { LIGHT_TIERS } from "@repo/core/types/light";
import { JourneyStreaks } from "@/components/light/journey-streaks";
import { JourneyTierMap } from "@/components/light/journey-tier-map";
import { JourneyStats } from "@/components/light/journey-stats";
import { JourneyFeed } from "@/components/light/journey-feed";
import { JourneyLightChart } from "@/components/light/journey-light-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function JourneyPage() {
  const { data: userLight, isLoading } = useUserLight();
  const { levelUpTier, dismiss } = useLevelUp(userLight);
  const today = format(new Date(), "yyyy-MM-dd");

  if (isLoading || !userLight) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      {/* Hero + Today's Progress — two-column on md+ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left: Hero — Star + Title + Progress */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent px-6 pb-6 pt-8">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute top-0 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />

          <StarVisual tier={userLight.currentTier} size="xl" />
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {userLight.currentTitle}
          </h1>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {userLight.totalLight.toLocaleString()} Light earned
          </p>
          <p className="mt-3 text-xs text-muted-foreground text-center leading-relaxed max-w-sm mx-auto">
            {LIGHT_TIERS[userLight.currentTier - 1]?.description}
          </p>
          <LevelProgress userLight={userLight} className="mt-5 w-full" />
        </div>

        {/* Right: Today's Progress + Quick Stats */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Today&apos;s Progress
            </h2>
            <ActivityRings date={today} size="lg" showLabels />
          </div>
          <JourneyStats userLight={userLight} />
        </div>
      </div>

      {/* Streaks */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Streaks
        </h2>
        <JourneyStreaks userLight={userLight} />
      </section>

      {/* Light Earned Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Light Earned</CardTitle>
        </CardHeader>
        <CardContent>
          <JourneyLightChart />
        </CardContent>
      </Card>

      {/* Tier Map */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tier Map
        </h2>
        <JourneyTierMap currentTier={userLight.currentTier} />
      </section>

      {/* Recent Light Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Light</CardTitle>
        </CardHeader>
        <CardContent>
          <JourneyFeed />
        </CardContent>
      </Card>

      {levelUpTier && (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      )}
    </div>
  );
}
