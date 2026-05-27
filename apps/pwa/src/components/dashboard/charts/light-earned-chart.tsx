import { AreaChart, Text, View, type ChartDatum } from "@stageholder/ui";
import { useLightTrend } from "@/lib/hooks/use-light-trend";

export function LightEarnedChart() {
  const { data, isLoading } = useLightTrend();

  if (isLoading) {
    return (
      <View height={200} items="center" justify="center">
        {/* allowlist: animate-spin — continuous loading spinner keyframe (no token equivalent) */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </View>
    );
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
