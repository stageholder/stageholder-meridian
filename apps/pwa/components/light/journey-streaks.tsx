'use client';

import { Flame, CheckCircle2, Repeat2, BookOpen } from 'lucide-react';
import type { UserLight } from '@repo/core/types/light';

interface JourneyStreaksProps {
  userLight: UserLight;
}

const streakCards = [
  {
    label: 'Perfect Day',
    icon: Flame,
    color: 'text-orange-500',
    currentKey: 'perfectDayStreak' as const,
    bestKey: 'longestPerfectStreak' as const,
  },
  {
    label: 'Todos',
    icon: CheckCircle2,
    color: 'text-blue-500',
    currentKey: 'todoRingStreak' as const,
    bestKey: null,
  },
  {
    label: 'Habits',
    icon: Repeat2,
    color: 'text-orange-500',
    currentKey: 'habitRingStreak' as const,
    bestKey: null,
  },
  {
    label: 'Journal',
    icon: BookOpen,
    color: 'text-green-500',
    currentKey: 'journalRingStreak' as const,
    bestKey: null,
  },
] as const;

export function JourneyStreaks({ userLight }: JourneyStreaksProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {streakCards.map((card) => {
        const Icon = card.icon;
        const current = userLight[card.currentKey];
        const best = card.bestKey ? userLight[card.bestKey] : null;

        return (
          <div
            key={card.label}
            className="rounded-lg border p-3 text-center"
          >
            <Icon className={`mx-auto size-5 ${card.color}`} />
            <p className="mt-1 text-lg font-bold tabular-nums">{current}d</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            {best !== null && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Best: {best}d
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
