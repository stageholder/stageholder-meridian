"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useJournalGrowth } from "@/lib/hooks/use-journal-growth";

const chartConfig = {
  entries: { label: "Total Entries", color: "var(--color-chart-1)" },
  words: { label: "Total Words", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

export function JournalGrowthChart() {
  const { data, isLoading } = useJournalGrowth();

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.entries > 0);
  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Start journaling to see your growth
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="entriesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-entries)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-entries)"
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient id="wordsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-words)"
              stopOpacity={0.2}
            />
            <stop offset="95%" stopColor="var(--color-words)" stopOpacity={0} />
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
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={28}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={40}
          allowDecimals={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                const label =
                  name === "entries" ? "Total Entries" : "Total Words";
                const formatted =
                  typeof value === "number" ? value.toLocaleString() : value;
                return (
                  <div className="flex w-full items-center justify-between gap-8">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor:
                            name === "entries"
                              ? "var(--color-entries)"
                              : "var(--color-words)",
                        }}
                      />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatted}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="entries"
          stroke="var(--color-entries)"
          fill="url(#entriesGradient)"
          strokeWidth={2}
          dot={false}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="words"
          stroke="var(--color-words)"
          fill="url(#wordsGradient)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
