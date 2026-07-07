import { useMemo } from "react";
import { useJournalHeatmapStats } from "@/lib/api/journals";
import type { WritingHeatmapDay } from "@repo/features/charts";

/**
 * Per-day journal word counts for the dashboard writing-activity heatmap.
 * Reads the wide-window journal stats (~1 year) and maps each day to its raw
 * (non-cumulative) word total — the heatmap colours each cell by that day's
 * volume, GitHub-contribution style.
 */
export function useWritingHeatmap() {
  const { data: stats, isLoading } = useJournalHeatmapStats();

  const data = useMemo<WritingHeatmapDay[]>(() => {
    const days = Array.isArray(stats?.days) ? stats.days : [];
    return days.map((d) => ({ date: d.date, words: d.words }));
  }, [stats]);

  return { data, isLoading };
}
