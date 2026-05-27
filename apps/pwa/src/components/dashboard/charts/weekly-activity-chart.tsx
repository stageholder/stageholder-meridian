import { BarChart, Text, View, type ChartDatum } from "@stageholder/ui";
import { useWeeklyActivity } from "@/lib/hooks/use-weekly-activity";

export function WeeklyActivityChart() {
  const { data, isLoading } = useWeeklyActivity();

  if (isLoading) {
    return (
      <View height={200} items="center" justify="center">
        {/* allowlist: animate-spin — continuous loading spinner keyframe (no token equivalent) */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </View>
    );
  }

  const hasData = data.some((d) => d.todos + d.habits + d.journals > 0);
  if (!hasData) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Complete some tasks to see trends
        </Text>
      </View>
    );
  }

  const chartData: ChartDatum[] = data.map((d) => ({
    label: d.label,
    value: d.todos + d.habits + d.journals,
  }));

  return (
    <BarChart
      data={chartData}
      height={200}
      showGrid
      color="var(--color-chart-1)"
      formatValue={(n) => String(n)}
    />
  );
}
