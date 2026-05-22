import { isToday, isSameMonth } from "date-fns";
import { Text, View, YStack } from "@stageholder/ui";
import { ActivityRingsVisual } from "@/components/activity-rings";
import { computeActivityRings } from "@/components/activity-rings";
import type { CalendarDayData } from "@/lib/api/calendar";
import type { Habit } from "@repo/core/types";

function countScheduledHabits(habits: Habit[], date: Date): number {
  const dow = date.getDay();
  return habits.filter((h) => {
    if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
    return h.scheduledDays.includes(dow);
  }).length;
}

interface CalendarCellProps {
  date: Date;
  currentMonth: Date;
  isSelected: boolean;
  dayData?: CalendarDayData;
  habits: Habit[];
  onClick: () => void;
}

export function CalendarCell({
  date,
  currentMonth,
  isSelected,
  dayData,
  habits,
  onClick,
}: CalendarCellProps) {
  const today = isToday(date);
  const inMonth = isSameMonth(date, currentMonth);

  const hasData =
    (dayData?.todos?.length ?? 0) > 0 ||
    (dayData?.journals?.length ?? 0) > 0 ||
    (dayData?.habitEntries?.length ?? 0) > 0;

  const scheduledCount = countScheduledHabits(habits, date);
  const ringsData = hasData
    ? computeActivityRings(dayData, scheduledCount)
    : null;

  return (
    <YStack
      tag="button"
      type="button"
      onPress={onClick}
      cursor="pointer"
      items="center"
      gap="$0.5"
      $sm={{ gap: "$1", p: "$2", minH: 60 }}
      rounded="$lg"
      p="$1"
      minH={48}
      borderWidth={1}
      borderColor={isSelected ? "$primary" : "transparent"}
      bg={isSelected ? "$accent" : today ? "$primaryMuted" : "transparent"}
      transition="quick"
      hoverStyle={isSelected ? undefined : { bg: "$accent" }}
    >
      <View
        width={20}
        height={20}
        $sm={{ width: 28, height: 28 }}
        items="center"
        justify="center"
        rounded={9999}
        bg={today ? "$primary" : "transparent"}
      >
        <Text
          fontSize="$1"
          $sm={{ fontSize: "$3" }}
          fontWeight="500"
          color={
            today
              ? "$primaryForeground"
              : inMonth
                ? "$color"
                : "$mutedForeground"
          }
          opacity={inMonth || today ? 1 : 0.5}
        >
          {date.getDate()}
        </Text>
      </View>
      {ringsData ? (
        <ActivityRingsVisual data={ringsData} size="xs" animate={false} />
      ) : (
        <View height={24} />
      )}
    </YStack>
  );
}
