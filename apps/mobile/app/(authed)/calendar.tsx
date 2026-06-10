// apps/mobile/app/(authed)/calendar.tsx
//
// Calendar — native mirror of the PWA's /calendar (apps/pwa/src/components/
// calendar/calendar-view.tsx), stacked for phones:
//
//   MONTH GRID — kit EventCalendar (cross-platform, own month nav) fed the
//                merged ±3-month window; every past/today cell renders a
//                mini ActivityRings (Apple-Fitness style, date number in the
//                hole). The PWA sizes cell rings with a ResizeObserver; on a
//                phone the 7-col cells are uniform, so a FIXED diameter does
//                the same job with zero measurement (industry-standard
//                simplification — no native ResizeObserver exists anyway).
//   DAY AGENDA — the selected day's todos / habits / journal below the grid
//                (components/calendar-day-agenda.tsx).
//
// Reached from the Today header's calendar icon; hidden tab (href null).

import { useMemo, useState } from "react";
import {
  ActivityRings,
  EventCalendar,
  IconButton,
  ScrollView,
  Separator,
  Spinner,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { activityRingsConfig } from "@repo/features/activity-rings";
import { ChevronLeft } from "@tamagui/lucide-icons-2";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CalendarDayAgenda } from "@/components/calendar-day-agenda";
import { CreateTodoDialog } from "@/components/create-todo-dialog";
import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import {
  EMPTY_DAY,
  buildCalendarEvents,
  computeActivityRings,
  countScheduledHabits,
  useCalendarRange,
} from "@/lib/api/hooks/calendar";
import { useHabits } from "@/lib/api";

// Fixed cell-ring geometry — ~92% of a typical 38px compact cell square,
// thin bands so the date number fits the center hole (PWA's formula with
// the measurement replaced by the constant it converges to on phones).
const CELL_RING = { size: 32, thickness: 3, gap: 1 } as const;

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [createTodoOpen, setCreateTodoOpen] = useState(false);

  const { data: calendarData, isLoading, isError } = useCalendarRange();
  const { data: habits } = useHabits();
  const habitsList = useMemo(() => habits ?? [], [habits]);

  const events = useMemo(
    () => buildCalendarEvents(calendarData),
    [calendarData],
  );

  const quotaIds = useMemo(
    () =>
      new Set(
        habitsList
          .filter((h) => h.frequency === "weekly_target")
          .map((h) => h.id),
      ),
    [habitsList],
  );

  const startOfToday = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }, []);

  const selectedDayData =
    calendarData[format(selectedDate, "yyyy-MM-dd")] ?? EMPTY_DAY;

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <XStack items="center" px="$2" py="$2" position="relative">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Back to today"
            onPress={() => router.navigate("/")}
          >
            <ChevronLeft size={20} />
          </IconButton>
          <Text
            position="absolute"
            l={0}
            r={0}
            text="center"
            pointerEvents="none"
            fontSize="$5"
            fontWeight="600"
            color="$color"
          >
            Calendar
          </Text>
        </XStack>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            pb: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
          <YStack gap="$4" px="$4" pt="$1" pb="$10">
            {isError ? (
              <XStack height={260} items="center" justify="center">
                <Text fontSize="$3" color="$destructive">
                  Failed to load the calendar. Pull back and retry.
                </Text>
              </XStack>
            ) : isLoading && events.length === 0 ? (
              <XStack height={260} items="center" justify="center">
                <Spinner size="large" />
              </XStack>
            ) : (
              <EventCalendar
                events={events}
                variant="month"
                density="compact"
                selectedDate={selectedDate}
                onDateClick={setSelectedDate}
                renderDayCell={({ date, isToday }) => {
                  const dayData = calendarData[format(date, "yyyy-MM-dd")];
                  // Rings for today + history; future shows just the date.
                  const showRing = date.getTime() <= startOfToday;
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
                    <YStack flex={1} items="center" justify="center" py="$0.5">
                      {showRing ? (
                        <ActivityRings
                          rings={activityRingsConfig(
                            computeActivityRings(
                              dayData,
                              countScheduledHabits(habitsList, date),
                              undefined,
                              quotaIds,
                            ),
                          )}
                          size={CELL_RING.size}
                          thickness={CELL_RING.thickness}
                          gap={CELL_RING.gap}
                        >
                          {dateNode}
                        </ActivityRings>
                      ) : (
                        dateNode
                      )}
                    </YStack>
                  );
                }}
              />
            )}

            <Separator />

            <CalendarDayAgenda
              date={selectedDate}
              dayData={selectedDayData}
              habits={habitsList}
              onAddTodo={() => setCreateTodoOpen(true)}
            />
          </YStack>
        </ScrollView>
      </SafeAreaView>

      {/* The selected day's date isn't forced onto the new todo — the form's
          date pickers default sensibly and stay editable (PWA agenda parity
          would pre-fill; CreateTodoDialog doesn't take dates yet). */}
      <CreateTodoDialog
        open={createTodoOpen}
        onOpenChange={setCreateTodoOpen}
      />
    </YStack>
  );
}
