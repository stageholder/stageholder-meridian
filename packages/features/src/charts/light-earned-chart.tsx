import {
  AreaChart,
  Skeleton,
  Text,
  View,
  type ChartDatum,
} from "@stageholder/ui";

/**
 * Per-day cumulative light total. Each app's `useLightTrend` hook
 * computes this from its own light-stats fetch.
 */
export interface LightTrendDay {
  /** ISO date (`yyyy-MM-dd`). */
  date: string;
  /** Short axis label (e.g. "MMM d"). */
  label: string;
  /** Cumulative light value at that day. */
  light: number;
}

export interface LightEarnedChartProps {
  data: LightTrendDay[];
  isLoading?: boolean;
}

export function LightEarnedChart({ data, isLoading }: LightEarnedChartProps) {
  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
  }

  const hasData = data.some((d) => d.light > 0);
  if (!hasData) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Complete tasks to start earning light
        </Text>
      </View>
    );
  }

  const chartData: ChartDatum[] = data.map((d) => ({
    label: d.label,
    value: d.light,
  }));

  return (
    <AreaChart
      data={chartData}
      height={200}
      showGrid
      continuous
      color="oklch(0.75 0.18 55)"
    />
  );
}
