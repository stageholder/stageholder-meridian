import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useJournalStats } from "@/lib/api/journals";

export interface JournalGrowthDay {
  date: string;
  label: string;
  entries: number;
  words: number;
}

export function useJournalGrowth() {
  const { data: stats, isLoading } = useJournalStats();

  const data = useMemo<JournalGrowthDay[]>(() => {
    if (!stats) return [];

    const dayMap = new Map(stats.days.map((d) => [d.date, d]));
    let cumCount = stats.baseline.totalCount;
    let cumWords = stats.baseline.totalWords;
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
