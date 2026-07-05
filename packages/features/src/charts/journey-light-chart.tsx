import {
  AreaChart,
  Skeleton,
  Text,
  View,
  XStack,
  type ChartDatum,
} from "@stageholder/ui";
import type { LightTrendDay } from "./light-earned-chart";
import { tabularNums } from "../_internal/text-styles";

/**
 * The journey-page variant of the light trend chart — adds a header
 * row ("Last 14 days / +N Light") above the area chart. Reuses
 * `LightTrendDay` from the dashboard's light-earned chart since both
 * apps' `useLightTrend` hooks produce the same shape.
 */
export interface JourneyLightChartProps {
  data: LightTrendDay[];
  isLoading?: boolean;
}

export function JourneyLightChart({ data, isLoading }: JourneyLightChartProps) {
  if (isLoading) {
    return <Skeleton height={180} width="100%" rounded="$3" />;
  }

  // Empty-state + window total both use per-day EARNED, not the cumulative
  // `light` (summing 14 running totals gave an absurd "+15,000" header).
  const hasData = data.some((d) => d.earned > 0);
  if (!hasData) {
    return (
      <View height={180} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Complete tasks to start earning light
        </Text>
      </View>
    );
  }

  const totalRecent = data.reduce((s, d) => s + d.earned, 0);

  const chartData: ChartDatum[] = data.map((d) => ({
    label: d.label,
    value: d.light,
  }));

  return (
    <View>
      <XStack mb="$2" items="center" justify="space-between">
        <Text fontSize="$1" color="$mutedForeground">
          Last 14 days
        </Text>
        {/* Decorative gold accent for the total — no kit token (style hatch). */}
        <Text
          fontSize="$1"
          fontWeight="500"
          style={{ color: "#d97706", ...tabularNums }}
        >
          +{totalRecent} Light
        </Text>
      </XStack>
      <AreaChart
        data={chartData}
        height={180}
        showGrid
        continuous
        color="oklch(0.75 0.18 55)"
      />
    </View>
  );
}
