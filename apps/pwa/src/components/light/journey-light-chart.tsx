import {
  AreaChart,
  Text,
  View,
  XStack,
  type ChartDatum,
} from "@stageholder/ui";
import { useLightTrend } from "@/lib/hooks/use-light-trend";

export function JourneyLightChart() {
  const { data, isLoading } = useLightTrend();

  if (isLoading) {
    return (
      <View height={180} items="center" justify="center">
        {/* allowlist: animate-spin — continuous loading spinner keyframe (no token equivalent) */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-amber-500" />
      </View>
    );
  }

  const hasData = data.some((d) => d.light > 0);
  if (!hasData) {
    return (
      <View height={180} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Complete tasks to start earning light
        </Text>
      </View>
    );
  }

  const totalRecent = data.reduce((s, d) => s + d.light, 0);

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
          style={{ color: "#d97706", fontVariantNumeric: "tabular-nums" }}
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
