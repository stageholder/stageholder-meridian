'use client';

import type { UserLight } from '@repo/core/types/light';

interface JourneyStatsProps {
  userLight: UserLight;
}

function getMultiplier(streak: number): number {
  if (streak >= 30) return 3;
  if (streak >= 14) return 2.5;
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

export function JourneyStats({ userLight }: JourneyStatsProps) {
  const stats = [
    {
      label: 'Total Light',
      value: userLight.totalLight.toLocaleString(),
    },
    {
      label: 'Perfect Days',
      value: String(userLight.perfectDaysTotal),
    },
    {
      label: 'Longest Streak',
      value: `${userLight.longestPerfectStreak}d`,
    },
    {
      label: 'Current Multiplier',
      value: `${getMultiplier(userLight.perfectDayStreak)}x`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border p-3">
          <p className="text-lg font-bold tabular-nums">{stat.value}</p>
          <p className="text-xs text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
