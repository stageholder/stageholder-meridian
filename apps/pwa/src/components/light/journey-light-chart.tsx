import { JourneyLightChart as JourneyLightChartView } from "@repo/features/charts";
import { useLightTrend } from "@/lib/hooks/use-light-trend";

/**
 * PWA wrapper: wires the local `useLightTrend` hook to the shared
 * cross-platform view (the journey-page variant with the header row).
 */
export function JourneyLightChart() {
  const { data, isLoading } = useLightTrend();
  return <JourneyLightChartView data={data} isLoading={isLoading} />;
}
