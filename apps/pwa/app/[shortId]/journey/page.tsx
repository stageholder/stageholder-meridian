'use client';

import { useUserLight } from '@/lib/api/light';
import { StarVisual } from '@/components/light/star-visual';
import { LevelProgress } from '@/components/light/level-progress';
import { JourneyStreaks } from '@/components/light/journey-streaks';
import { JourneyTierMap } from '@/components/light/journey-tier-map';
import { JourneyStats } from '@/components/light/journey-stats';
import { JourneyFeed } from '@/components/light/journey-feed';

export default function JourneyPage() {
  const { data: userLight, isLoading } = useUserLight();

  if (isLoading || !userLight) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        <StarVisual tier={userLight.currentTier} size="xl" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          {userLight.currentTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {userLight.totalLight.toLocaleString()} Light earned
        </p>
        <LevelProgress userLight={userLight} className="mt-4" />
      </div>

      {/* Streaks */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Streaks
        </h2>
        <JourneyStreaks userLight={userLight} />
      </section>

      {/* Tier Map */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tier Map
        </h2>
        <JourneyTierMap currentTier={userLight.currentTier} />
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Stats
        </h2>
        <JourneyStats userLight={userLight} />
      </section>

      {/* Recent Light */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Recent Light
        </h2>
        <JourneyFeed />
      </section>
    </div>
  );
}
