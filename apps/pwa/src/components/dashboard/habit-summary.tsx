import { Skeleton, Text, YStack } from "@stageholder/ui";
import { HabitListItem } from "@/components/habits/habit-list-item";
import { useHabits } from "@/lib/api/habits";

const MAX_ROWS = 5;

/**
 * Today's habits on the dashboard — the SAME real `HabitListItem` used on the
 * /habits LIST view (icon · name · week-dot streak strip · check-in / status ·
 * skip/fail/undo menu). Richer + more representative than a stripped card.
 * Shows habits scheduled today (quota habits are tracked weekly on /habits, so
 * they're excluded), capped at {@link MAX_ROWS}. "View all" nav is owned by the
 * host `Dashboard.Widget`.
 */
export function HabitSummary() {
  const { data: habits, isLoading } = useHabits();

  if (isLoading) {
    return (
      <YStack gap="$2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={40} width="100%" rounded="$3" />
        ))}
      </YStack>
    );
  }

  if (!habits || habits.length === 0) {
    return (
      <YStack py="$4" items="center">
        <Text fontSize="$2" color="$mutedForeground">
          No habits to track yet.
        </Text>
      </YStack>
    );
  }

  const todayDow = new Date().getDay();
  const scheduledToday = habits.filter(
    (h) =>
      h.frequency !== "weekly_target" &&
      (!h.scheduledDays ||
        h.scheduledDays.length === 0 ||
        h.scheduledDays.includes(todayDow)),
  );
  const shown = scheduledToday.slice(0, MAX_ROWS);

  if (shown.length === 0) {
    return (
      <YStack py="$4" items="center">
        <Text fontSize="$2" color="$mutedForeground">
          Nothing scheduled for today.
        </Text>
      </YStack>
    );
  }

  return (
    <YStack gap="$2">
      {shown.map((habit) => (
        <HabitListItem key={habit.id} habit={habit} />
      ))}
      {scheduledToday.length > shown.length ? (
        <Text mt="$1" ml="$2" fontSize="$1" color="$mutedForeground">
          +{scheduledToday.length - shown.length} more
        </Text>
      ) : null}
    </YStack>
  );
}
