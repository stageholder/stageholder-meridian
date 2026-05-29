import {
  AreaChart,
  Skeleton,
  Text,
  View,
  type ChartDatum,
} from "@stageholder/ui";

/**
 * Per-day mood score (1–5) for the trend chart. `mood` is nullable for
 * days the user didn't journal — the kit `AreaChart` can't render gaps,
 * so the view maps nulls to 0 (which AreaChart shows as no column).
 */
export interface MoodTrendDay {
  /** Short axis label (e.g. "MMM d"). */
  label: string;
  /** 1–5 mood score, or `null` when no entry on that day. */
  mood: number | null;
}

export interface MoodTrendChartProps {
  data: MoodTrendDay[];
  isLoading?: boolean;
}

export function MoodTrendChart({ data, isLoading }: MoodTrendChartProps) {
  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
  }

  const hasData = data.some((d) => d.mood !== null);
  if (!hasData) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Add mood to journal entries to see trends
        </Text>
      </View>
    );
  }

  const chartData: ChartDatum[] = data.map((d) => ({
    label: d.label,
    value: d.mood ?? 0,
  }));

  return (
    <AreaChart
      data={chartData}
      height={200}
      showGrid
      continuous
      color="var(--color-chart-4)"
    />
  );
}
