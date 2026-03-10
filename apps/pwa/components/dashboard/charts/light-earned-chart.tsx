"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useLightTrend } from "@/lib/hooks/use-light-trend";

const chartConfig = {
  light: { label: "Light Earned", color: "oklch(0.75 0.18 55)" },
} satisfies ChartConfig;

export function LightEarnedChart() {
  const { data, isLoading } = useLightTrend();

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    );
  }

  const hasData = data.some((d) => d.light > 0);
  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Complete tasks to start earning light
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="lightGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-light)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-light)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={30} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="light"
          stroke="var(--color-light)"
          fill="url(#lightGradient)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-light)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
