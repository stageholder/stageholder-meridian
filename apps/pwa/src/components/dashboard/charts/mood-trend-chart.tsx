import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Text, View } from "@stageholder/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMoodTrend } from "@/lib/hooks/use-mood-trend";

const chartConfig = {
  mood: { label: "Mood", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

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

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-mood)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-mood)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[1, 5]}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={24}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="mood"
          stroke="var(--color-mood)"
          fill="url(#moodGradient)"
          strokeWidth={2}
          connectNulls
          dot={{ r: 3, fill: "var(--color-mood)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
