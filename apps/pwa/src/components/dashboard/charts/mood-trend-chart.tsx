import { AreaChart, Text, View, type ChartDatum } from "@stageholder/ui";
import { useMoodTrend } from "@/lib/hooks/use-mood-trend";

export function MoodTrendChart() {
  const { data, isLoading } = useMoodTrend();

  if (isLoading) {
    return (
      <View height={200} items="center" justify="center">
        {/* allowlist: animate-spin — continuous loading spinner keyframe (no token equivalent) */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </View>
    );
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
