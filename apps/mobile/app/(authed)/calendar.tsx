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
  IconButton,
  ScrollView,
  Separator,
  Spinner,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
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
import { WeekStrip } from "@/components/week-strip";
import { EMPTY_DAY, useCalendarRange } from "@/lib/api/hooks/calendar";
import { useHabits } from "@/lib/api";

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [createTodoOpen, setCreateTodoOpen] = useState(false);

  const { data: calendarData, isLoading, isError } = useCalendarRange();
  const { data: habits } = useHabits();
  const habitsList = useMemo(() => habits ?? [], [habits]);

  const quotaIds = useMemo(
    () =>
      new Set(
        habitsList
          .filter((h) => h.frequency === "weekly_target")
          .map((h) => h.id),
      ),
    [habitsList],
  );

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
              <XStack height={120} items="center" justify="center">
                <Text fontSize="$3" color="$destructive">
                  Failed to load the calendar. Pull back and retry.
                </Text>
              </XStack>
            ) : isLoading && Object.keys(calendarData).length === 0 ? (
              <XStack height={120} items="center" justify="center">
                <Spinner size="large" />
              </XStack>
            ) : (
              <YStack gap="$2">
                {/* Month label follows the selected day. */}
                <Text fontSize="$5" fontWeight="600" color="$color" px="$1">
                  {format(selectedDate, "MMMM yyyy")}
                </Text>
                {/* Apple-Fitness weekly strip (PWA Apple-redesign parity):
                    date-on-top, hollow static rings, no grid borders, paged
                    horizontal week scrolling. Replaces the kit EventCalendar
                    month grid, whose bordered cells + date-in-hole cells
                    diverged from the PWA design. */}
                <WeekStrip
                  calendarData={calendarData}
                  habits={habitsList}
                  quotaIds={quotaIds}
                  selectedKey={format(selectedDate, "yyyy-MM-dd")}
                  onSelectDay={setSelectedDate}
                />
              </YStack>
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

      {/* Pre-fill the tapped day's date so a todo added from the calendar is
          actually DUE that day (PWA agenda parity) — the field stays editable. */}
      <CreateTodoDialog
        open={createTodoOpen}
        onOpenChange={setCreateTodoOpen}
        defaultDueDate={format(selectedDate, "yyyy-MM-dd")}
      />
    </YStack>
  );
}
