import {
  AreaChart,
  Skeleton,
  Text,
  View,
  type ChartDatum,
} from "@stageholder/ui";

/**
 * Per-day journal entry counts for the trend chart. Each app's
 * `useJournalGrowth` hook produces this shape.
 */
export interface JournalGrowthDay {
  /** Short axis label (e.g. "MMM d"). */
  label: string;
  entries: number;
}

export interface JournalGrowthChartProps {
  data: JournalGrowthDay[];
  isLoading?: boolean;
}

export function JournalGrowthChart({
  data,
  isLoading,
}: JournalGrowthChartProps) {
  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
  }

  const hasData = data.length > 0 && data.some((d) => d.entries > 0);
  if (!hasData) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Start journaling to see your growth
        </Text>
      </View>
    );
  }

  const chartData: ChartDatum[] = data.map((d) => ({
    label: d.label,
    value: d.entries,
  }));

  return (
    <AreaChart
      data={chartData}
      height={200}
      showGrid
      continuous
      color="var(--color-chart-1)"
    />
  );
}
