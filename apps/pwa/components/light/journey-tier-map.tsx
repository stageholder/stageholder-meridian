'use client';

import { cn } from '@/lib/utils';
import { StarVisual } from './star-visual';
import { LIGHT_TIERS } from '@repo/core/types/light';

interface JourneyTierMapProps {
  currentTier: number;
}

export function JourneyTierMap({ currentTier }: JourneyTierMapProps) {
  return (
    <div className="grid grid-cols-5 gap-4">
      {LIGHT_TIERS.map((tier) => {
        const isCompleted = tier.tier < currentTier;
        const isCurrent = tier.tier === currentTier;
        const isFuture = tier.tier > currentTier;

        return (
          <div
            key={tier.tier}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-3 transition-all',
              isCurrent && 'border-amber-500/50 bg-amber-500/5',
              isCompleted && 'border-border bg-muted/30',
              isFuture && 'border-border/50 opacity-40',
            )}
          >
            <StarVisual tier={tier.tier} size="md" animate={isCurrent} />
            <div className="text-center">
              <p
                className={cn(
                  'text-xs font-medium',
                  isCurrent && 'text-amber-500',
                  isCompleted && 'text-muted-foreground',
                  isFuture && 'text-muted-foreground',
                )}
              >
                {tier.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {tier.lightRequired.toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
