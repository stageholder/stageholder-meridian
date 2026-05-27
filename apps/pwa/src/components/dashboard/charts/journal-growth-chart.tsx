import { AreaChart, Text, View, type ChartDatum } from "@stageholder/ui";
import { useJournalGrowth } from "@/lib/hooks/use-journal-growth";

export function JournalGrowthChart() {
  const { data, isLoading } = useJournalGrowth();

  if (isLoading) {
    return (
      <View height={200} items="center" justify="center">
        {/* allowlist: animate-spin — continuous loading spinner keyframe (no token equivalent) */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </View>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.entries > 0);
  if (!hasData) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Start journaling to see your growth
        </Text>
      </View>
    );
  }

  const chartData: ChartDatum[] = data.map((d) => ({
    label: d.label,
    value: d.entries,
  }));

  return (
    <AreaChart
      data={chartData}
      height={200}
      showGrid
      continuous
      color="var(--color-chart-1)"
    />
  );
}
