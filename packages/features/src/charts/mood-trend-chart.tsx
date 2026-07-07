import { AreaChart, Skeleton, Text, View } from "@stageholder/ui";

/**
 * Per-day mood score (1–5) for the trend chart. `mood` is `null` for days
 * the user didn't journal; the kit v2 `AreaChart` renders `y: null` as a gap
 * in the line (connectNulls is off), so no-entry days read as breaks.
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

  // Kit v2 AreaChart is series-based. `null` mood keeps a gap in the line
  // (connectNulls is off by default), which reads better than a 0 dip.
  return (
    <AreaChart
      height={200}
      showGrid
      showLegend={false}
      series={[
        {
          id: "mood",
          label: "Mood",
          color: "$warning",
          points: data.map((d) => ({ x: d.label, y: d.mood })),
        },
      ]}
    />
  );
}
