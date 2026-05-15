// apps/mobile/components/dashboard/WeeklyActivityChart.tsx
//
// 7-day stacked bar chart of todos done + habits checked + journal entries
// per day. Mirrors PWA's WeeklyActivityChart
// (apps/pwa/components/dashboard/charts/weekly-activity-chart.tsx).
//
// Data source: useCalendarData(month). If the 7-day window crosses a month
// boundary we fetch both months in parallel.
//
// We use Chart.BarChart (View-based, no SVG) and pre-flatten each day's
// total since BarChart doesn't natively stack — the chart shows a single
// bar per day and color-codes by the dominant surface; the totals legend
// breaks down the categories.

import {
  BarChart,
  Card,
  Paragraph,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useMemo } from "react";

import { useCalendarData } from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

const TODO_COLOR = IGNITION.todo.base;
const HABIT_COLOR = IGNITION.habit.base;
const JOURNAL_COLOR = IGNITION.journal.base;

function fmtMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shortDow(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
}

export function WeeklyActivityChart() {
  const today = new Date();
  const currentMonth = fmtMonth(today);
  const sevenAgo = new Date(today);
  sevenAgo.setDate(today.getDate() - 6);
  const prevMonth = fmtMonth(sevenAgo);
  const needsPrev = prevMonth !== currentMonth;

  const currentQuery = useCalendarData(currentMonth);
  const prevQuery = useCalendarData(needsPrev ? prevMonth : null);

  const isLoading =
    currentQuery.isLoading || (needsPrev && prevQuery.isLoading);

  const data = useMemo(() => {
    const days: {
      label: string;
      key: string;
      todos: number;
      habits: number;
      journals: number;
      total: number;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = fmtDate(d);
      const month = fmtMonth(d);
      const calData =
        month === currentMonth ? currentQuery.data : prevQuery.data;
      const dayData = calData?.[key];
      const todos =
        dayData?.todos.filter((t) => t.status === "done").length ?? 0;
      const habits = new Set(
        dayData?.habitEntries
          .filter((e) => e.type !== "skip" && e.value > 0)
          .map((e) => e.habitId) ?? [],
      ).size;
      const journals = dayData?.journals.length ?? 0;
      days.push({
        label: shortDow(d),
        key,
        todos,
        habits,
        journals,
        total: todos + habits + journals,
      });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuery.data, prevQuery.data]);

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, d) => ({
          todos: acc.todos + d.todos,
          habits: acc.habits + d.habits,
          journals: acc.journals + d.journals,
        }),
        { todos: 0, habits: 0, journals: 0 },
      ),
    [data],
  );
  const hasData = totals.todos + totals.habits + totals.journals > 0;

  // Pick the dominant surface per-day so the single-bar color reflects
  // "what carried this day". When tied, prefer todos > habits > journals
  // (matches the ordering of the legend below).
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        value: d.total,
        color:
          d.todos >= d.habits && d.todos >= d.journals && d.todos > 0
            ? TODO_COLOR
            : d.habits >= d.journals && d.habits > 0
              ? HABIT_COLOR
              : d.journals > 0
                ? JOURNAL_COLOR
                : "#475569",
      })),
    [data],
  );

  return (
    <Card>
      <Card.Header>
        <YStack gap="$1">
          <Paragraph
            fontFamily="$mono"
            fontSize={10}
            letterSpacing={1.6}
            textTransform="uppercase"
            color="$color11"
            fontWeight="600"
          >
            Last 7 days
          </Paragraph>
          <Paragraph fontSize="$3" color="$color12" fontWeight="500">
            Activity
          </Paragraph>
        </YStack>
      </Card.Header>
      <Card.Body gap="$3">
        {isLoading ? (
          <Paragraph fontSize="$2" color="$color11" py="$4" text="center">
            Loading…
          </Paragraph>
        ) : !hasData ? (
          <Paragraph fontSize="$2" color="$color11" py="$4" text="center">
            Complete something this week to see trends.
          </Paragraph>
        ) : (
          <>
            <BarChart data={chartData} height={120} showValues={false} />
            <XStack gap="$4" justify="center" flexWrap="wrap">
              <LegendDot color={TODO_COLOR} label={`Todos · ${totals.todos}`} />
              <LegendDot
                color={HABIT_COLOR}
                label={`Habits · ${totals.habits}`}
              />
              <LegendDot
                color={JOURNAL_COLOR}
                label={`Journal · ${totals.journals}`}
              />
            </XStack>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <XStack items="center" gap="$1.5">
      <YStack width={6} height={6} rounded={3} bg={color as never} />
      <Text fontSize="$1" color="$color11">
        {label}
      </Text>
    </XStack>
  );
}
