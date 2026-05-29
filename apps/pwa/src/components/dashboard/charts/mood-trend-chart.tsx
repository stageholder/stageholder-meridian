import { MoodTrendChart as MoodTrendChartView } from "@repo/features/charts";
import { useMoodTrend } from "@/lib/hooks/use-mood-trend";

/**
 * PWA wrapper: wires the local `useMoodTrend` hook to the shared
 * cross-platform view.
 */
export function MoodTrendChart() {
  const { data, isLoading } = useMoodTrend();
  return <MoodTrendChartView data={data} isLoading={isLoading} />;
}
