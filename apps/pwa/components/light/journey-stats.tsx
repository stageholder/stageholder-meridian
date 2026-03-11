"use client";

import { Sparkles, Calendar, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserLight } from "@repo/core/types/light";

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
      label: "Total Light",
      value: userLight.totalLight.toLocaleString(),
      icon: Sparkles,
      color: "text-amber-500",
    },
    {
      label: "Perfect Days",
      value: String(userLight.perfectDaysTotal),
      icon: Calendar,
      color: "text-emerald-500",
    },
    {
      label: "Longest Streak",
      value: `${userLight.longestPerfectStreak}d`,
      icon: Trophy,
      color: "text-blue-500",
    },
    {
      label: "Multiplier",
      value: `${getMultiplier(userLight.perfectDayStreak)}x`,
      icon: Zap,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <Icon className={cn("size-4 shrink-0", stat.color)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tabular-nums leading-tight">
                {stat.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
