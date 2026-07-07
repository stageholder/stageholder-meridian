import {
  StackedBarChart,
  Skeleton,
  Text,
  View,
  type StackedBarDatum,
  type StackedBarSeries,
} from "@stageholder/ui";

/**
 * Per-day breakdown of the three productivity pillars Meridian tracks.
 * Both `apps/pwa` and `apps/mobile` produce this shape from their respective
 * `useWeeklyActivity` hooks and feed it to `WeeklyActivityChart`.
 */
export interface WeeklyActivityDay {
  /** Short axis label (e.g. "Thu", "Fri"). */
  label: string;
  todos: number;
  habits: number;
  journals: number;
}

export interface WeeklyActivityChartProps {
  data: WeeklyActivityDay[];
  isLoading?: boolean;
}

/**
 * Each day's completed todos + habits + journal entries, drawn as a STACKED
 * bar so you can see the pillar mix at a glance — each segment in its identity
 * colour (todo = red, habit = orange, journal = yellow). The legend names the
 * segments. Journal is entry COUNT (not words) so the three stack comparably.
 * Identity hexes mirror the ring palette (RING_CATEGORY) — raw hex, not
 * `var(--ring-*)`, which Tamagui v2 rejects as a colour.
 */
const SERIES: StackedBarSeries[] = [
  { id: "todos", label: "Todos", color: "#ef4444" },
  { id: "habits", label: "Habits", color: "#f97316" },
  { id: "journals", label: "Journals", color: "#facc15" },
];

export function WeeklyActivityChart({
  data,
  isLoading,
}: WeeklyActivityChartProps) {
  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
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

  const chartData: StackedBarDatum[] = data.map((d) => ({
    label: d.label,
    values: [d.todos, d.habits, d.journals],
  }));

  return (
    <StackedBarChart
      data={chartData}
      series={SERIES}
      mode="stacked"
      height={200}
      plain
      showGrid={false}
      formatValue={(n) => String(n)}
    />
  );
}
