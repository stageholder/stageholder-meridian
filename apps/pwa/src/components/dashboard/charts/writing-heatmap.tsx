import { WritingHeatmapChart as WritingHeatmapChartView } from "@repo/features/charts";
import { useWritingHeatmap } from "@/lib/hooks/use-writing-heatmap";

/**
 * PWA wrapper: wires the local `useWritingHeatmap` hook to the shared
 * cross-platform view. Colour is baked into the view (journal identity
 * yellow), so no `color` prop is needed here.
 */
export function WritingHeatmap() {
  const { data, isLoading } = useWritingHeatmap();
  return <WritingHeatmapChartView data={data} isLoading={isLoading} />;
}
