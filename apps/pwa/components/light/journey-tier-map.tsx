'use client';

import { cn } from '@/lib/utils';
import { StarVisual } from './star-visual';
import { LIGHT_TIERS } from '@repo/core/types/light';

interface JourneyTierMapProps {
  currentTier: number;
}

export function JourneyTierMap({ currentTier }: JourneyTierMapProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-y-4">
      {LIGHT_TIERS.map((tier, index) => {
        const isCompleted = tier.tier < currentTier;
        const isCurrent = tier.tier === currentTier;
        const isFuture = tier.tier > currentTier;

        return (
          <div key={tier.tier} className="flex items-center">
            <div
              className={cn(
                'flex flex-col items-center gap-1',
                isFuture && 'opacity-30',
              )}
            >
              <StarVisual
                tier={tier.tier}
                size="sm"
                animate={isCurrent}
                className={cn(isCurrent && 'animate-pulse')}
              />
              <span
                className={cn(
                  'text-[10px] leading-tight',
                  isCurrent
                    ? 'font-bold text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {tier.title}
              </span>
            </div>

            {/* Connecting line between tiers */}
            {index < LIGHT_TIERS.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-px w-4',
                  isCompleted ? 'bg-amber-500' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
