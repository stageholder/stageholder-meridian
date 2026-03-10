'use client';

import { Flame, CheckCircle2, Repeat2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserLight } from '@repo/core/types/light';

interface JourneyStreaksProps {
  userLight: UserLight;
}

const streakCards = [
  {
    label: 'Perfect Day',
    icon: Flame,
    color: 'text-amber-500',
    ringColor: 'stroke-amber-500',
    trackColor: 'stroke-amber-500/15',
    currentKey: 'perfectDayStreak' as const,
    bestKey: 'longestPerfectStreak' as const,
    maxDays: 30,
  },
  {
    label: 'Todos',
    icon: CheckCircle2,
    color: 'text-blue-500',
    ringColor: 'stroke-blue-500',
    trackColor: 'stroke-blue-500/15',
    currentKey: 'todoRingStreak' as const,
    bestKey: null,
    maxDays: 14,
  },
  {
    label: 'Habits',
    icon: Repeat2,
    color: 'text-orange-500',
    ringColor: 'stroke-orange-500',
    trackColor: 'stroke-orange-500/15',
    currentKey: 'habitRingStreak' as const,
    bestKey: null,
    maxDays: 14,
  },
  {
    label: 'Journal',
    icon: BookOpen,
    color: 'text-emerald-500',
    ringColor: 'stroke-emerald-500',
    trackColor: 'stroke-emerald-500/15',
    currentKey: 'journalRingStreak' as const,
    bestKey: null,
    maxDays: 14,
  },
] as const;

function StreakRing({ current, max, ringColor, trackColor }: { current: number; max: number; ringColor: string; trackColor: string }) {
  const pct = Math.min(100, (current / max) * 100);
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (circumference * pct) / 100;

  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className={trackColor} />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className={ringColor}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
    </svg>
  );
}

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
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="relative flex items-center justify-center">
              <StreakRing
                current={current}
                max={card.maxDays}
                ringColor={card.ringColor}
                trackColor={card.trackColor}
              />
              <Icon className={cn('absolute size-4', card.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold tabular-nums leading-tight">{current}d</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              {best !== null && (
                <p className="text-[10px] text-muted-foreground">Best: {best}d</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
