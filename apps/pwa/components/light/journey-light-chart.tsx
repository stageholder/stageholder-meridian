"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useLightTrend } from "@/lib/hooks/use-light-trend";

const chartConfig = {
  light: { label: "Light Earned", color: "oklch(0.75 0.18 55)" },
} satisfies ChartConfig;

export function JourneyLightChart() {
  const { data, isLoading } = useLightTrend();

  if (isLoading) {
    return (
      <div className="flex h-[180px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-amber-500" />
      </div>
    );
  }

  const hasData = data.some((d) => d.light > 0);
  if (!hasData) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        Complete tasks to start earning light
      </div>
    );
  }

  const totalRecent = data.reduce((s, d) => s + d.light, 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Last 14 days</span>
        <span className="text-xs font-medium text-amber-600 tabular-nums dark:text-amber-400">
          +{totalRecent} Light
        </span>
      </div>
      <ChartContainer config={chartConfig} className="h-[180px] w-full">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="journeyLightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-light)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-light)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="light"
            stroke="var(--color-light)"
            fill="url(#journeyLightGradient)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--color-light)" }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
