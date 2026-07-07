// apps/mobile/lib/use-writing-heatmap.ts
//
// Per-day journal word counts for the dashboard writing-activity heatmap —
// port of the PWA's use-writing-heatmap over mobile's useJournalHeatmapStats.
// Feeds the shared WritingHeatmapChart view (@repo/features/charts). Raw
// per-day words (not cumulative): the heatmap colours each cell by that day's
// volume, GitHub-contribution style.

import { useMemo } from "react";

import { useJournalHeatmapStats } from "@/lib/api";
import { localDateKey } from "@/lib/streak";
import type { WritingHeatmapDay } from "@repo/features/charts";

export function useWritingHeatmap() {
  // Anchor the server's window on the LOCAL day (the API is timezone-agnostic).
  const { data: stats, isLoading } = useJournalHeatmapStats(localDateKey());

  const data = useMemo<WritingHeatmapDay[]>(() => {
    const days = Array.isArray(stats?.days) ? stats.days : [];
    return days.map((d) => ({ date: d.date, words: d.words }));
  }, [stats]);

  return { data, isLoading };
}
