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
  /** Cumulative light total at that day (what the area chart plots). */
  light: number;
  /** Light EARNED on that specific day. Use this — not the cumulative
   *  `light` — for window totals ("+N in the last 14 days") and the
   *  has-any-activity empty-state check. */
  earned: number;
}

export interface LightEarnedChartProps {
  data: LightTrendDay[];
  isLoading?: boolean;
}

export function LightEarnedChart({ data, isLoading }: LightEarnedChartProps) {
  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
  }

  // Base the empty-state on Light EARNED in the window, not the cumulative
  // total (which is >0 for any returning user, so the empty-state never showed).
  const hasData = data.some((d) => d.earned > 0);
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
      // Gold/amber "light" accent as HEX (≈ oklch(0.75 0.18 55)) — RN's SVG
      // color parser can't read oklch(), so a CSS-space value silently breaks
      // the native render. Hex resolves identically on both platforms.
      color="#fb923c"
    />
  );
}
