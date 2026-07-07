import { JournalGrowthChart as JournalGrowthChartView } from "@repo/features/charts";
import { useJournalGrowth } from "@/lib/hooks/use-journal-growth";

/**
 * PWA wrapper: wires the local `useJournalGrowth` hook to the shared
 * cross-platform view.
 */
export function JournalGrowthChart() {
  const { data, isLoading } = useJournalGrowth();
  // Journal identity colour (resolved hex, not `var(--ring-journal)` — the kit
  // chart's colour resolver doesn't take CSS vars). Ties the growth trend to
  // its Writing Activity heatmap sitting beside it.
  return (
    <JournalGrowthChartView data={data} isLoading={isLoading} color="#facc15" />
  );
}
