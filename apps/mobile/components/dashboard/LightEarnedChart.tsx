// apps/mobile/components/dashboard/LightEarnedChart.tsx
//
// 30-day area chart of total light earned per day. Mirrors PWA's
// LightEarnedChart on the dashboard — pulls from useLightStats which
// returns daily totals.

import {
  AreaChart,
  Card,
  Paragraph,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useMemo } from "react";

import { useLightStats } from "@/lib/api";

const LIGHT_COLOR = "#a855f7";

function shortLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}`;
}

export function LightEarnedChart() {
  const statsQuery = useLightStats();
  const days = statsQuery.data?.days ?? [];

  // Last 30 days only (most relevant on a small screen) — server may
  // return more.
  const last30 = useMemo(() => days.slice(-30), [days]);

  const total = useMemo(
    () => last30.reduce((s, d) => s + d.light, 0),
    [last30],
  );
  const peak = useMemo(
    () => last30.reduce((m, d) => Math.max(m, d.light), 0),
    [last30],
  );

  const chartData = useMemo(
    () =>
      last30.map((d) => ({
        label: shortLabel(d.date),
        value: d.light,
        color: LIGHT_COLOR,
      })),
    [last30],
  );

  return (
    <Card>
      <Card.Header>
        <XStack items="center" justify="space-between">
          <YStack gap="$1">
            <Paragraph
              fontFamily="$mono"
              fontSize={10}
              letterSpacing={1.6}
              textTransform="uppercase"
              color="$color11"
              fontWeight="600"
            >
              Light earned · 30 days
            </Paragraph>
            <Paragraph fontSize="$3" color="$color12" fontWeight="500">
              {total.toLocaleString()} total
            </Paragraph>
          </YStack>
          <Text fontSize="$1" color="$color11" fontFamily="$mono">
            Peak {peak}
          </Text>
        </XStack>
      </Card.Header>
      <Card.Body>
        {statsQuery.isLoading ? (
          <Paragraph fontSize="$2" color="$color11" py="$4" text="center">
            Loading…
          </Paragraph>
        ) : total === 0 ? (
          <Paragraph fontSize="$2" color="$color11" py="$4" text="center">
            No light earned yet this month.
          </Paragraph>
        ) : (
          <AreaChart data={chartData} height={120} color={LIGHT_COLOR} />
        )}
      </Card.Body>
    </Card>
  );
}
