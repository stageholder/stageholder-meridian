import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Text, View, XStack } from "@stageholder/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useLightTrend } from "@/lib/hooks/use-light-trend";

const chartConfig = {
  light: { label: "Light Earned", color: "oklch(0.75 0.18 55)" },
} satisfies ChartConfig;

export function JourneyLightChart() {
  const { data, isLoading } = useLightTrend();

  if (isLoading) {
    return (
      <View height={180} items="center" justify="center">
        {/* allowlist: animate-spin — continuous loading spinner keyframe (no token equivalent) */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-amber-500" />
      </View>
    );
  }

  const hasData = data.some((d) => d.light > 0);
  if (!hasData) {
    return (
      <View height={180} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Complete tasks to start earning light
        </Text>
      </View>
    );
  }

  const totalRecent = data.reduce((s, d) => s + d.light, 0);

  return (
    <View>
      <XStack mb="$2" items="center" justify="space-between">
        <Text fontSize="$1" color="$mutedForeground">
          Last 14 days
        </Text>
        {/* Decorative gold accent for the total — no kit token (style hatch). */}
        <Text
          fontSize="$1"
          fontWeight="500"
          style={{ color: "#d97706", fontVariantNumeric: "tabular-nums" }}
        >
          +{totalRecent} Light
        </Text>
      </XStack>
      <ChartContainer config={chartConfig} className="h-[180px] w-full">
        <AreaChart data={data}>
          <defs>
            <linearGradient
              id="journeyLightGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor="var(--color-light)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="var(--color-light)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={28}
            allowDecimals={false}
          />
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
    </View>
  );
}
