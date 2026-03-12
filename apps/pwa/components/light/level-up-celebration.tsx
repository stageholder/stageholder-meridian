"use client";

import { useEffect } from "react";
import { StarVisual } from "./star-visual";
import { LIGHT_TIERS } from "@repo/core/types/light";

interface LevelUpCelebrationProps {
  tier: number;
  onDismiss: () => void;
}

export function LevelUpCelebration({
  tier,
  onDismiss,
}: LevelUpCelebrationProps) {
  const tierInfo = LIGHT_TIERS[tier - 1];
  const tierTitle = tierInfo?.title ?? "Unknown";

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDismiss();
      }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <StarVisual tier={tier} size="xl" animate />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">
            You&apos;ve become a {tierTitle}
          </h2>
          <p className="text-sm text-white/60">Tap to dismiss</p>
        </div>
      </div>
    </div>
  );
}
