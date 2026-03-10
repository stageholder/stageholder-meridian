import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useJournals } from "@/lib/api/journals";

interface MoodTrendDay {
  date: string;
  label: string;
  mood: number | null;
}

export function useMoodTrend() {
  const today = new Date();
  const startDate = format(subDays(today, 13), "yyyy-MM-dd");
  const endDate = format(today, "yyyy-MM-dd");

  const { data: journals, isLoading } = useJournals({ startDate, endDate });

  const data = useMemo(() => {
    const moodByDate = new Map<string, number[]>();
    for (const j of journals ?? []) {
      if (j.mood != null) {
        const dateStr = j.date?.split("T")[0] ?? format(new Date(j.createdAt), "yyyy-MM-dd");
        const arr = moodByDate.get(dateStr) ?? [];
        arr.push(j.mood);
        moodByDate.set(dateStr, arr);
      }
    }

    const days: MoodTrendDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const moods = moodByDate.get(dateStr);
      days.push({
        date: dateStr,
        label: format(d, "MMM d"),
        mood: moods ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
      });
    }
    return days;
  }, [journals]);

  return { data, isLoading };
}
