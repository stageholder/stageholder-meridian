"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
      <div className="flex h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    );
  }

  const hasData = data.some((d) => d.mood !== null);
  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Add mood to journal entries to see trends
      </div>
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
