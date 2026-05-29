import { WeeklyActivityChart as WeeklyActivityChartView } from "@repo/features/charts";
import { useWeeklyActivity } from "@/lib/hooks/use-weekly-activity";

/**
 * PWA wrapper: wires the local `useWeeklyActivity` hook to the shared
 * cross-platform view. The mobile app will ship its own wrapper of the
 * same name around `WeeklyActivityChartView` with its own data source.
 */
export function WeeklyActivityChart() {
  const { data, isLoading } = useWeeklyActivity();
  return <WeeklyActivityChartView data={data} isLoading={isLoading} />;
}
