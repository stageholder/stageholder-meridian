import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
} from "date-fns";
import { Grid, Hide, Show, Text, View, YStack } from "@stageholder/ui";
import { CalendarCell } from "./calendar-cell";
import type { CalendarData } from "@/lib/api/calendar";
import type { Habit } from "@repo/core/types";

const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date | null;
  calendarData: CalendarData;
  habits: Habit[];
  onSelectDate: (date: Date) => void;
}

export function CalendarGrid({
  currentMonth,
  selectedDate,
  calendarData,
  habits,
  onSelectDate,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <YStack>
      <Grid columns={7} gap="$1" mb="$0.5">
        {WEEKDAYS_LONG.map((day, i) => (
          <View key={day} py="$2">
            <Text
              fontSize="$1"
              fontWeight="500"
              color="$mutedForeground"
              text="center"
            >
              <Show above="sm">{day}</Show>
              <Hide above="sm">{WEEKDAYS_SHORT[i]}</Hide>
            </Text>
          </View>
        ))}
      </Grid>
      <Grid columns={7} gap="$1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          return (
            <CalendarCell
              key={dateKey}
              date={day}
              currentMonth={currentMonth}
              isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
              dayData={calendarData[dateKey]}
              habits={habits}
              onClick={() => onSelectDate(day)}
            />
          );
        })}
      </Grid>
    </YStack>
  );
}
