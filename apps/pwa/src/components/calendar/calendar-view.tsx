import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { format } from "date-fns";
import {
  ActivityRings,
  EventCalendar,
  Text,
  View,
  XStack,
  YStack,
  type ActivityRing,
} from "@stageholder/ui";
import { DayAgenda } from "./day-agenda";
import {
  useCalendarRange,
  buildCalendarEvents,
  type CalendarDayData,
} from "@/lib/api/calendar";
import { useHabits } from "@/lib/api/habits";
import {
  computeActivityRings,
  activityRingsConfig,
} from "@/lib/hooks/use-activity-rings";
import type { Habit } from "@repo/core/types";

const EMPTY_DAY: CalendarDayData = {
  todos: [],
  journals: [],
  habitEntries: [],
};

// Habits scheduled on a given weekday — the denominator for the habit ring.
// Quota (`weekly_target`) habits aren't day-scheduled, so they're excluded.
function countScheduledHabits(habits: Habit[], date: Date): number {
  const dow = date.getDay();
  return habits.filter(
    (h) =>
      h.frequency !== "weekly_target" &&
      (!h.scheduledDays?.length || h.scheduledDays.includes(dow)),
  ).length;
}

/**
 * Activity ring that scales to its (square) calendar cell. The kit
 * `ActivityRings` is fixed-px, so we measure the cell and size the ring to
 * ~70% of it — keeping it proportional as the calendar grows/shrinks.
 */
function CellActivityRing({
  rings,
  children,
}: {
  rings: ActivityRing[];
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [diameter, setDiameter] = useState(38);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const s = Math.min(box.width, box.height); // fill the square cell
      if (s > 0) setDiameter(Math.max(20, Math.min(84, Math.round(s * 0.92))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Thin bands so the date number fits in the center hole.
  const thickness = Math.max(2.5, Math.round(diameter / 13));
  const gap = Math.max(1, Math.round(diameter / 26));

  return (
    <View
      ref={ref as never}
      flex={1}
      width="100%"
      items="center"
      justify="center"
      overflow="hidden"
    >
      <ActivityRings
        rings={rings}
        size={diameter}
        thickness={thickness}
        gap={gap}
      >
        {children}
      </ActivityRings>
    </View>
  );
}

export function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // One merged window (today ±3 months) feeds EventCalendar's own month nav —
  // it manages the visible month internally and filters events to it.
  const { data: calendarData, isLoading, isError } = useCalendarRange();
  const { data: habits } = useHabits();
  const habitsList = habits ?? [];

  const events = useMemo(
    () => buildCalendarEvents(calendarData),
    [calendarData],
  );

  // Start of today (local). Past + today cells always render their ring (a
  // track-only "empty" ring for inactive days) so the month reads as history;
  // future cells show just the date.
  const startOfToday = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }, []);

  const selectedDayData =
    calendarData[format(selectedDate, "yyyy-MM-dd")] ?? EMPTY_DAY;

  return (
    <YStack
      gap="$6"
      $lg={{ flexDirection: "row", items: "flex-start", justify: "center" }}
    >
      {/* Today agenda — the primary surface (todos / habits / journal). */}
      <View width="100%" $lg={{ width: 420 }}>
        <DayAgenda
          date={selectedDate}
          dayData={selectedDayData}
          habits={habitsList}
        />
      </View>

      {/* Calendar — compact, sticky overview/navigator on the right.
          `meridian-cal-square` forces square day cells (see globals.css). */}
      <YStack
        width="100%"
        gap="$4"
        className="meridian-cal-square"
        $lg={{ width: 520, position: "sticky" as never, top: "$4" }}
      >
        {isError ? (
          <XStack height={320} items="center" justify="center">
            <Text fontSize="$3" color="$destructive">
              Failed to load calendar. Please try refreshing the page.
            </Text>
          </XStack>
        ) : isLoading && events.length === 0 ? (
          <XStack height={320} items="center" justify="center">
            <Text fontSize="$3" color="$mutedForeground">
              Loading calendar…
            </Text>
          </XStack>
        ) : (
          <View width="100%" maxW={520}>
            <EventCalendar
              events={events}
              variant="month"
              density="comfortable"
              selectedDate={selectedDate}
              onDateClick={setSelectedDate}
              renderDayCell={({ date, isToday }) => {
                const dayData = calendarData[format(date, "yyyy-MM-dd")];
                // Show the ring for today and every past day (history); future
                // days show just the date.
                const showRing = date.getTime() <= startOfToday;
                // Date number lives in the center of the ring (Apple-Fitness
                // style) so the ring can fill the whole cell.
                const dateNode = (
                  <Text
                    fontSize={10}
                    fontWeight={isToday ? "700" : "500"}
                    color="$color"
                  >
                    {date.getDate()}
                  </Text>
                );
                return (
                  <YStack flex={1} items="center" justify="center">
                    {showRing ? (
                      <CellActivityRing
                        rings={activityRingsConfig(
                          computeActivityRings(
                            dayData,
                            countScheduledHabits(habitsList, date),
                            undefined,
                            new Set(
                              habitsList
                                .filter((h) => h.frequency === "weekly_target")
                                .map((h) => h.id),
                            ),
                          ),
                        )}
                      >
                        {dateNode}
                      </CellActivityRing>
                    ) : (
                      dateNode
                    )}
                  </YStack>
                );
              }}
            />
          </View>
        )}
      </YStack>
    </YStack>
  );
}
