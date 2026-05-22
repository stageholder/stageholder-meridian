import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Text, View } from "@stageholder/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useWeeklyActivity } from "@/lib/hooks/use-weekly-activity";

const chartConfig = {
  todos: { label: "Todos", color: "var(--color-chart-3)" },
  habits: { label: "Habits", color: "var(--color-chart-2)" },
  journals: { label: "Journals", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

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

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <BarChart data={data} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          allowDecimals={false}
          width={24}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="todos"
          stackId="a"
          fill="var(--color-todos)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="habits"
          stackId="a"
          fill="var(--color-habits)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="journals"
          stackId="a"
          fill="var(--color-journals)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
