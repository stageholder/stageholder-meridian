// apps/mobile/components/week-strip.tsx
//
// Apple-Fitness-style weekly calendar strip — the mobile calendar's top
// surface, replacing the kit EventCalendar month grid (whose bordered cells
// + date-in-ring-hole layout diverged from the PWA's Apple redesign:
// date-on-top, hollow rings, no grid chrome).
//
//   ‹ swipe ›   S    M    T    W    T    F    S      ← one PAGE = one week
//               21   22   23   24   25   26   27     ← date number ON TOP
//               ◎    ◎    ◎    ◎    ·    ·    ·     ← rings below (≤ today)
//
// - Horizontal PAGED FlatList (native paging physics), one week per page,
//   Monday start (app-wide convention: weekStartsOn 1).
// - Date number: filled primary circle when SELECTED, primary text when
//   today; tap any day to drive the agenda below.
// - Rings: the shared StaticActivityRings (plain SVG — the strip shows up
//   to 21 mounted rings across 3 pages; animated kit rings here would be
//   ~60 idle Reanimated circles). Future days render an empty slot so
//   columns stay aligned.
// - Range: 13 weeks back / 2 forward — matches the ±3-month calendar cache
//   (useCalendarRange), so paging never fetches, just reads.

import { memo, useCallback, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { addDays, format, startOfWeek } from "date-fns";
import type { Habit } from "@repo/core/types";
import { activityRingsConfig } from "@repo/features/activity-rings";

import { StaticActivityRings } from "@/components/static-activity-rings";
import {
  computeActivityRings,
  countScheduledHabits,
  type CalendarData,
} from "@/lib/api/hooks/calendar";

const WEEKS_BACK = 13;
const WEEKS_FORWARD = 2;
const RING = { size: 34, thickness: 3, gap: 1 } as const;

interface WeekStripProps {
  calendarData: CalendarData;
  habits: Habit[];
  quotaIds: Set<string>;
  /** Selected day, yyyy-MM-dd. */
  selectedKey: string;
  onSelectDay: (date: Date) => void;
}

export function WeekStrip({
  calendarData,
  habits,
  quotaIds,
  selectedKey,
  onSelectDay,
}: WeekStripProps) {
  // Self-measured page width — the strip lives inside the screen's padded
  // column, so pages must match the CONTAINER, not the window (pagingEnabled
  // pages by the list's own viewport width).
  const [width, setWidth] = useState(0);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  // Week-start anchors, oldest → newest; index WEEKS_BACK = current week.
  const weeks = useMemo(() => {
    const current = startOfWeek(new Date(), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let i = -WEEKS_BACK; i <= WEEKS_FORWARD; i++) {
      out.push(addDays(current, i * 7));
    }
    return out;
  }, []);

  const renderWeek = useCallback(
    ({ item: weekStart }: { item: Date }) => (
      <WeekPage
        weekStart={weekStart}
        width={width}
        calendarData={calendarData}
        habits={habits}
        quotaIds={quotaIds}
        selectedKey={selectedKey}
        todayKey={todayKey}
        onSelectDay={onSelectDay}
      />
    ),
    [width, calendarData, habits, quotaIds, selectedKey, todayKey, onSelectDay],
  );

  return (
    <View
      width="100%"
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      {width > 0 ? (
        <FlatList
          data={weeks}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={WEEKS_BACK}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          keyExtractor={(d) => d.toISOString()}
          renderItem={renderWeek}
          // A strip is 3 pages of mounted content at most — keep it tight.
          windowSize={3}
          maxToRenderPerBatch={2}
          style={{ flexGrow: 0 }}
        />
      ) : null}
    </View>
  );
}

const WeekPage = memo(function WeekPage({
  weekStart,
  width,
  calendarData,
  habits,
  quotaIds,
  selectedKey,
  todayKey,
  onSelectDay,
}: {
  weekStart: Date;
  width: number;
  calendarData: CalendarData;
  habits: Habit[];
  quotaIds: Set<string>;
  selectedKey: string;
  todayKey: string;
  onSelectDay: (date: Date) => void;
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  return (
    <XStack width={width} justify="space-between">
      {days.map((date) => {
        const key = format(date, "yyyy-MM-dd");
        const isToday = key === todayKey;
        const isSelected = key === selectedKey;
        const isFuture = key > todayKey;
        return (
          <YStack
            key={key}
            items="center"
            gap="$1.5"
            py="$2"
            onPress={() => onSelectDay(date)}
            pressStyle={{ opacity: 0.6 }}
            role="button"
            aria-label={`Select ${key}`}
          >
            {/* Weekday letter */}
            <Text
              fontSize={11}
              fontWeight="600"
              color={isToday ? "$primary" : "$mutedForeground"}
            >
              {format(date, "EEEEE")}
            </Text>
            {/* Date number ON TOP of the ring (PWA Apple-redesign parity).
                Selected = filled primary circle; today = primary text. */}
            <View
              width={28}
              height={28}
              items="center"
              justify="center"
              rounded={9999}
              bg={isSelected ? "$primary" : "transparent"}
            >
              <Text
                fontSize={14}
                fontWeight={isToday || isSelected ? "700" : "500"}
                color={isSelected ? "white" : isToday ? "$primary" : "$color"}
              >
                {date.getDate()}
              </Text>
            </View>
            {/* Ring below — history + today only; future keeps the slot so
                the 7 columns stay height-aligned. */}
            {isFuture ? (
              <View width={RING.size} height={RING.size} />
            ) : (
              <StaticActivityRings
                rings={activityRingsConfig(
                  computeActivityRings(
                    calendarData[key],
                    countScheduledHabits(habits, date),
                    undefined,
                    quotaIds,
                  ),
                )}
                size={RING.size}
                thickness={RING.thickness}
                gap={RING.gap}
              />
            )}
          </YStack>
        );
      })}
    </XStack>
  );
});
