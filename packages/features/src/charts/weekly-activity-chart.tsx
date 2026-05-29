import {
  BarChart,
  Skeleton,
  Text,
  View,
  type ChartDatum,
} from "@stageholder/ui";

/**
 * Per-day breakdown of the three productivity pillars Meridian tracks.
 * Both `apps/pwa` and the future `apps/mobile` produce this shape from their
 * respective `useWeeklyActivity` hooks and feed it to `WeeklyActivityChart`.
 */
export interface WeeklyActivityDay {
  /** Short axis label (e.g. "Thu", "Fri"). */
  label: string;
  todos: number;
  habits: number;
  journals: number;
}

export interface WeeklyActivityChartProps {
  data: WeeklyActivityDay[];
  isLoading?: boolean;
}

/**
 * Sum of todos + habits + journals per day, rendered as a single bar series.
 * recharts shipped this as a stacked series in the old PWA chart; the kit's
 * cross-platform `BarChart` is single-value so we sum into one bar — same
 * intent (overall activity that day), cleaner for native rendering.
 */
export function WeeklyActivityChart({
  data,
  isLoading,
}: WeeklyActivityChartProps) {
  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
  }

  const hasData = data.some((d) => d.todos + d.habits + d.journals > 0);
  if (!hasData) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Complete some tasks to see trends
        </Text>
      </View>
    );
  }

  const chartData: ChartDatum[] = data.map((d) => ({
    label: d.label,
    value: d.todos + d.habits + d.journals,
  }));

  return (
    <BarChart
      data={chartData}
      height={200}
      showGrid
      color="var(--color-chart-1)"
      formatValue={(n) => String(n)}
    />
  );
}
