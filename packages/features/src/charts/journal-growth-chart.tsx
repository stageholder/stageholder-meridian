import { AreaChart, Skeleton, Text, View } from "@stageholder/ui";

/**
 * Per-day cumulative journal totals for the trend chart. Each app's
 * `useJournalGrowth` hook produces this shape.
 */
export interface JournalGrowthDay {
  /** Short axis label (e.g. "MMM d"). */
  label: string;
  /** Cumulative journal entries at that day. */
  entries: number;
  /** Cumulative words written at that day — what the trend plots. */
  words: number;
}

export interface JournalGrowthChartProps {
  data: JournalGrowthDay[];
  isLoading?: boolean;
  /**
   * Line/area color — a kit `$token` (resolves on web AND native via the kit
   * chart's colour resolver) or a raw hex. Not a CSS `var(...)`, which won't
   * resolve on React Native.
   */
  color?: string;
}

export function JournalGrowthChart({
  data,
  isLoading,
  color = "$info",
}: JournalGrowthChartProps) {
  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
  }

  const hasData = data.length > 0 && data.some((d) => d.words > 0);
  if (!hasData) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Start journaling to see your growth
        </Text>
      </View>
    );
  }

  return (
    <AreaChart
      height={200}
      plain
      showGrid={false}
      showLegend={false}
      showXAxis={false}
      showYAxis={false}
      series={[
        {
          id: "words",
          label: "Words",
          color,
          points: data.map((d) => ({ x: d.label, y: d.words })),
        },
      ]}
    />
  );
}
