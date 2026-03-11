import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useLightEvents } from "@/lib/api/light";

interface LightTrendDay {
  date: string;
  label: string;
  light: number;
}

export function useLightTrend() {
  const { data: events, isLoading } = useLightEvents(100, 0);

  const data = useMemo(() => {
    const today = new Date();
    const lightByDate = new Map<string, number>();
    for (const e of events ?? []) {
      const dateStr =
        e.date?.split("T")[0] ?? format(new Date(e.createdAt), "yyyy-MM-dd");
      lightByDate.set(dateStr, (lightByDate.get(dateStr) ?? 0) + e.totalLight);
    }

    const days: LightTrendDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      days.push({
        date: dateStr,
        label: format(d, "MMM d"),
        light: lightByDate.get(dateStr) ?? 0,
      });
    }
    return days;
  }, [events]);

  return { data, isLoading };
}
