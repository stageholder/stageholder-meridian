import { Progress, Text, XStack, YStack } from "@stageholder/ui";
import type { Habit } from "@repo/core/types";
import { resolveTargetCount } from "@repo/core/habits/entry-resolution";
import { tabularNums } from "../_internal/text-styles";

// In-progress habit bar is a generic orange (shadcn bg-orange-500/400). There's
// no orange kit token, so it lives on the style escape hatch (the completed
// state uses the $success token). Mirrors habit-card.tsx's free-form-color hatch.
const PROGRESS_ORANGE = "#f97316";

/** Per-day habit entry aggregate (value + type + snapshot of original target). */
export interface HabitProgressValue {
  value: number;
  type?: string;
  targetCountSnapshot?: number;
}

export interface HabitSummaryProps {
  /** All habits from the host's data layer; view filters to non-quota. */
  habits: Habit[] | undefined;
  /**
   * Per-habit progress for TODAY, keyed by habit id. The host computes
   * this from its calendar-day fetch + entry aggregation.
   */
  habitProgress: Map<string, HabitProgressValue>;
  isLoading?: boolean;
}

/**
 * CONTENT-ONLY dashboard cell body summarizing today's habit progress. Card
 * chrome (title, "View all", grid position) is owned by the host's kit
 * `Dashboard.Widget`. The view owns the presentation logic (excluding quota
 * habits, per-habit pct + status rendering); the host supplies the raw
 * `habits` + the precomputed `habitProgress` Map.
 */
export function HabitSummary({
  habits,
  habitProgress,
  isLoading,
}: HabitSummaryProps) {
  // Quota (`weekly_target`) habits aren't due on any specific day — they're
  // tracked weekly on /habits — so they're excluded from this daily summary.
  const dayHabits = (habits ?? []).filter(
    (h) => h.frequency !== "weekly_target",
  );

  return (
    <YStack gap="$3">
      {isLoading ? (
        <Text fontSize="$1" color="$mutedForeground">
          Loading...
        </Text>
      ) : !habits || habits.length === 0 ? (
        <Text fontSize="$1" color="$mutedForeground">
          No habits to track yet.
        </Text>
      ) : dayHabits.length === 0 ? (
        <Text fontSize="$1" color="$mutedForeground">
          Nothing scheduled for today.
        </Text>
      ) : (
        dayHabits.slice(0, 5).map((habit) => {
          const todayDow = new Date().getDay();
          const isScheduledToday =
            !habit.scheduledDays ||
            habit.scheduledDays.length === 0 ||
            habit.scheduledDays.includes(todayDow);
          const progress = habitProgress.get(habit.id);
          const value = progress?.value ?? 0;
          const isSkipped = progress?.type === "skip";
          const isFailed = progress?.type === "fail";
          const target = resolveTargetCount(
            { targetCountSnapshot: progress?.targetCountSnapshot },
            habit,
          );
          const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
          const isComplete = !isSkipped && !isFailed && value >= target;

          if (!isScheduledToday) {
            return (
              <XStack key={habit.id} items="center" gap="$3">
                <Text
                  flex={1}
                  numberOfLines={1}
                  fontSize="$3"
                  color="$mutedForeground"
                >
                  {habit.name}
                </Text>
                <Text fontSize={10} color="$mutedForeground" opacity={0.6}>
                  Rest day
                </Text>
              </XStack>
            );
          }

          if (isFailed) {
            return (
              <XStack key={habit.id} items="center" gap="$3">
                <Text
                  flex={1}
                  numberOfLines={1}
                  fontSize="$3"
                  color="$mutedForeground"
                  textDecorationLine="line-through"
                >
                  {habit.name}
                </Text>
                <Text fontSize={10} fontWeight="500" color="$destructive">
                  ✕ Failed
                </Text>
              </XStack>
            );
          }

          if (isSkipped) {
            return (
              <XStack key={habit.id} items="center" gap="$3">
                <Text
                  flex={1}
                  numberOfLines={1}
                  fontSize="$3"
                  color="$mutedForeground"
                >
                  {habit.name}
                </Text>
                <Text fontSize={10} color="$mutedForeground" opacity={0.6}>
                  Skipped
                </Text>
              </XStack>
            );
          }

          return (
            <YStack key={habit.id} gap="$1">
              <XStack items="center" justify="space-between">
                <Text
                  flex={1}
                  numberOfLines={1}
                  fontSize="$3"
                  color={isComplete ? "$mutedForeground" : "$color"}
                  textDecorationLine={isComplete ? "line-through" : "none"}
                >
                  {habit.name}
                </Text>
                <Text
                  ml="$2"
                  shrink={0}
                  fontSize="$1"
                  color="$mutedForeground"
                  style={tabularNums}
                >
                  {value}/{target}
                </Text>
              </XStack>
              <Progress value={pct} height={6} bg="$muted" rounded={9999}>
                <Progress.Indicator
                  transition="medium"
                  bg={isComplete ? "$success" : undefined}
                  style={
                    isComplete
                      ? undefined
                      : { backgroundColor: PROGRESS_ORANGE }
                  }
                />
              </Progress>
            </YStack>
          );
        })
      )}
    </YStack>
  );
}
