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
  /**
   * Area color. The default is the PWA's CSS chart variable, which does NOT
   * resolve on React Native — native callers must pass a `$token` (the kit
   * chart resolves theme tokens cross-platform) or a raw hex.
   */
  color?: string;
}

export function JournalGrowthChart({
  data,
  isLoading,
  color = "var(--color-chart-1)",
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
      color={color}
    />
  );
}
