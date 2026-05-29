import { LightEarnedChart as LightEarnedChartView } from "@repo/features/charts";
import { useLightTrend } from "@/lib/hooks/use-light-trend";

/**
 * PWA wrapper: wires the local `useLightTrend` hook to the shared
 * cross-platform view.
 */
export function LightEarnedChart() {
  const { data, isLoading } = useLightTrend();
  return <LightEarnedChartView data={data} isLoading={isLoading} />;
}
