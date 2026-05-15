import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useLightStats } from "@/lib/api/light";

interface LightTrendDay {
  date: string;
  label: string;
  light: number;
}

export function useLightTrend() {
  const { data: stats, isLoading } = useLightStats();

  const data = useMemo<LightTrendDay[]>(() => {
    if (!stats) return [];

    const dayMap = new Map(stats.days.map((d) => [d.date, d]));
    let cumulative = stats.baseline.totalLight;
    const today = new Date();
    const result: LightTrendDay[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const day = dayMap.get(dateStr);
      cumulative += day?.light ?? 0;
      result.push({
        date: dateStr,
        label: format(d, "MMM d"),
        light: cumulative,
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  return { data, isLoading };
}
