import {
  BarChart,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/** Light identity colour (gold/amber). Raw hex — RN can't read oklch(). */
const LIGHT_COLOR = "#fb923c";

/**
 * Per-day light figures. Each app's `useLightTrend` hook computes this from
 * its own light-stats fetch.
 */
export interface LightTrendDay {
  /** ISO date (`yyyy-MM-dd`). */
  date: string;
  /** Short axis label (e.g. "MMM d"). */
  label: string;
  /** Cumulative light total at that day. */
  light: number;
  /** Light EARNED on that specific day — what the histogram plots (and what
   *  window totals / the has-any-activity empty-state check read). */
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

  // Gapped columns of light EARNED per day via the kit `BarChart`, which labels
  // the hovered bar IN PLACE (Histogram floats the readout at top-centre). A
  // legend row on top + day labels at the bottom mirror the Weekly Activity
  // chart beside it, so the two cards balance in height and structure.
  return (
    <YStack gap="$2">
      {/* Legend row — matches the kit chart Legend so this card lines up with
          Weekly Activity's stacked legend beside it. */}
      <XStack flexWrap="wrap" gap="$3">
        <XStack items="center" gap="$1.5">
          <View width={10} height={10} rounded={3} bg={LIGHT_COLOR} />
          <Text fontSize="$1" color="$mutedForeground">
            Light earned
          </Text>
        </XStack>
      </XStack>

      <BarChart
        height={200}
        plain
        showGrid={false}
        showXAxis
        color={LIGHT_COLOR}
        data={data.map((d) => ({ label: d.label, value: d.earned }))}
        formatValue={(n) => String(n)}
      />
    </YStack>
  );
}
