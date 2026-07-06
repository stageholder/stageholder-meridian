// apps/mobile/lib/use-journal-growth.ts
//
// 30-day cumulative journal growth (entries + words on an all-time baseline)
// — port of the PWA's apps/pwa/src/lib/hooks/use-journal-growth.ts over
// mobile's useJournalStats. Feeds the shared JournalGrowthChart view
// (@repo/features/charts). Cumulative on purpose: the chart plots "how much
// I've written", not per-day counts.

import { useMemo } from "react";
import { format, subDays } from "date-fns";

import { useJournalStats } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

export interface JournalGrowthDay {
  date: string;
  label: string;
  entries: number;
  words: number;
}

export function useJournalGrowth() {
  // Anchor the server's 30-day window on the LOCAL day (the API is
  // timezone-agnostic; PWA passes the same param).
  const { data: stats, isLoading } = useJournalStats(localDateKey());

  const data = useMemo<JournalGrowthDay[]>(() => {
    // Shape guard (mirrors use-light-trend): never trust a cached/older-shape
    // payload to carry `days`/`baseline` before the live fetch lands.
    const days = Array.isArray(stats?.days) ? stats.days : [];
    if (!stats || days.length === 0) return [];

    const dayMap = new Map(days.map((d) => [d.date, d]));
    let cumCount = stats.baseline?.totalCount ?? 0;
    let cumWords = stats.baseline?.totalWords ?? 0;
    const today = new Date();
    const result: JournalGrowthDay[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const day = dayMap.get(dateStr);
      cumCount += day?.count ?? 0;
      cumWords += day?.words ?? 0;
      result.push({
        date: dateStr,
        label: format(d, "MMM d"),
        entries: cumCount,
        words: cumWords,
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  return { data, isLoading };
}
