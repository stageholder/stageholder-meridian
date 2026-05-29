import { JournalGrowthChart as JournalGrowthChartView } from "@repo/features/charts";
import { useJournalGrowth } from "@/lib/hooks/use-journal-growth";

/**
 * PWA wrapper: wires the local `useJournalGrowth` hook to the shared
 * cross-platform view.
 */
export function JournalGrowthChart() {
  const { data, isLoading } = useJournalGrowth();
  return <JournalGrowthChartView data={data} isLoading={isLoading} />;
}
