import { format, subDays } from "date-fns";
import type { UserLight } from "@repo/core/types/light";
import type { DashboardStatItem } from "@repo/features/dashboard";
import { useActivityRings } from "./use-activity-rings";
import { useLightTrend } from "./use-light-trend";
import { todayLocal } from "@/lib/date";

/** Day-over-day trend for a metric — up/down/flat with a signed count. */
function delta(today: number, yesterday: number): DashboardStatItem["delta"] {
  const diff = today - yesterday;
  if (diff > 0) return { direction: "up", label: `↑ ${diff}` };
  if (diff < 0) return { direction: "down", label: `↓ ${Math.abs(diff)}` };
  return { direction: "flat", label: "—" };
}

/**
 * The dashboard KPI row's data — Light, streak, todos, habits, journal, each
 * with a "vs yesterday" delta. Composed entirely from queries the dashboard
 * already loads: `useActivityRings` for today AND yesterday reads the SAME
 * cached calendar-month query (cheap), and `useLightTrend` already carries
 * per-day `earned`. Returns the shape `<DashboardStats>` renders directly.
 */
export function useDashboardStats(userLight?: UserLight): {
  stats: DashboardStatItem[];
  isLoading: boolean;
} {
  const today = todayLocal();
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const { details: t, isLoading: todayLoading } = useActivityRings(today);
  const { details: y } = useActivityRings(yesterday);
  const { data: trend, isLoading: trendLoading } = useLightTrend();

  const lightToday = trend.at(-1)?.earned ?? 0;
  const lightYesterday = trend.at(-2)?.earned ?? 0;
  const streak = userLight?.perfectDayStreak ?? 0;

  // Cold-loading if the rings/light/level data hasn't arrived — the host shows
  // a skeleton strip instead of flashing zeros that then count-up to the real
  // numbers.
  const isLoading = todayLoading || trendLoading || !userLight;

  const stats: DashboardStatItem[] = [
    {
      key: "light",
      label: "Light today",
      value: lightToday,
      delta: delta(lightToday, lightYesterday),
    },
    {
      key: "streak",
      label: "Day streak",
      value: streak,
    },
    {
      key: "todos",
      label: "Todos",
      display: `${t.todoDone} / ${t.todoTarget}`,
      delta: delta(t.todoDone, y.todoDone),
    },
    {
      key: "habits",
      label: "Habits",
      display: `${t.habitDone} / ${t.habitTotal}`,
      delta: delta(t.habitDone, y.habitDone),
    },
    {
      key: "journal",
      label: "Journal words",
      display: `${t.journalWords} / ${t.journalTarget}`,
      delta: delta(t.journalWords, y.journalWords),
    },
  ];

  return { stats, isLoading };
}
