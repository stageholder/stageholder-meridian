// apps/mobile/lib/use-light-trend.ts
//
// 14-day cumulative Light trend — verbatim port of the PWA's
// apps/pwa/src/lib/hooks/use-light-trend.ts over mobile's useLightStats.
// Feeds the shared JourneyLightChart view (@repo/features/charts), which
// renders the kit's cross-platform <AreaChart>.

import { useMemo } from "react";
import { format, subDays } from "date-fns";

import { useLightStats } from "@/lib/api";

interface LightTrendDay {
  date: string;
  label: string;
  light: number;
  earned: number;
}

export function useLightTrend() {
  const { data: stats, isLoading } = useLightStats();

  const data = useMemo<LightTrendDay[]>(() => {
    // Shape guard for the persisted (AsyncStorage) cache: a stale/older-shape
    // rehydrated `stats` could lack `days`/`baseline` and throw on `.map`
    // before the refetch lands. Normalize defensively (mirrors the feed's
    // Array.isArray guard).
    const days = Array.isArray(stats?.days) ? stats.days : [];
    if (!stats || days.length === 0) return [];

    const dayMap = new Map(days.map((d) => [d.date, d]));
    let cumulative = stats.baseline?.totalLight ?? 0;
    const today = new Date();
    const result: LightTrendDay[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const day = dayMap.get(dateStr);
      const earned = day?.light ?? 0;
      cumulative += earned;
      result.push({
        date: dateStr,
        label: format(d, "MMM d"),
        light: cumulative,
        earned,
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  return { data, isLoading };
}
