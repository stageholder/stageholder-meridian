"use client";

import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";
import type { UserLight } from "@repo/core/types/light";
import {
  getNextTier,
  getTierProgress,
  LIGHT_TIERS,
} from "@repo/core/types/light";

interface LevelProgressProps {
  userLight: UserLight;
  className?: string;
}

function getMultiplierDisplay(streak: number): string {
  if (streak >= 14) return "3x";
  if (streak >= 10) return "2.5x";
  if (streak >= 7) return "2x";
  if (streak >= 3) return "1.5x";
  return "1x";
}

export function LevelProgress({ userLight, className }: LevelProgressProps) {
  const { totalLight, currentTier, currentTitle, perfectDayStreak } = userLight;
  const nextTier = getNextTier(currentTier);
  const progress = getTierProgress(totalLight, currentTier);

  const currentTierData = LIGHT_TIERS[currentTier - 1];
  const lightInTier = totalLight - (currentTierData?.lightRequired ?? 0);
  const tierRange = nextTier
    ? nextTier.lightRequired - (currentTierData?.lightRequired ?? 0)
    : 0;

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Top row: current title — next title */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground">{currentTitle}</span>
        {nextTier && (
          <span className="text-muted-foreground">{nextTier.title}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Bottom row: light count — streak */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {nextTier
            ? `${totalLight.toLocaleString()} / ${nextTier.lightRequired.toLocaleString()} Light`
            : `${totalLight.toLocaleString()} Light (Max)`}
        </span>
        {perfectDayStreak > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-amber-500" />
            <span className="tabular-nums">
              {getMultiplierDisplay(perfectDayStreak)} streak {perfectDayStreak}
              d
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
