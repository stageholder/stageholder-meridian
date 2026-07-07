import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useLightStats } from "@/lib/api/light";

interface LightTrendDay {
  date: string;
  label: string;
  light: number;
  earned: number;
}

export function useLightTrend() {
  const { data: stats, isLoading } = useLightStats();

  const data = useMemo<LightTrendDay[]>(() => {
    if (!stats) return [];

    const dayMap = new Map(stats.days.map((d) => [d.date, d]));
    let cumulative = stats.baseline.totalLight;
    const today = new Date();
    const result: LightTrendDay[] = [];

    // Last 7 days with day-of-week labels — mirrors useWeeklyActivity so the
    // Light Growth bars line up with the Weekly Activity chart beside them.
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const day = dayMap.get(dateStr);
      const earned = day?.light ?? 0;
      cumulative += earned;
      result.push({
        date: dateStr,
        label: format(d, "EEE"),
        light: cumulative,
        earned,
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  return { data, isLoading };
}
