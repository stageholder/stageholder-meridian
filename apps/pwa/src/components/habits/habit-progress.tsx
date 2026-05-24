import { Progress, StreakBadge, Text, XStack, YStack } from "@stageholder/ui";

interface HabitProgressProps {
  value: number;
  targetCount: number;
  color?: string;
  streak: number;
}

// The per-habit fill color is a free-form hex (and the complete-state green)
// — no kit token, so it's applied to the Progress indicator via the `style`
// escape hatch (hex resolves on web + native). The streak now uses the kit
// StreakBadge (auto-tiers cold→blazing) instead of a hand-rolled flame pill.
const COMPLETE_GREEN = "#22c55e";

export function HabitProgress({
  value,
  targetCount,
  color,
  streak,
}: HabitProgressProps) {
  const percentage =
    targetCount > 0 ? Math.min((value / targetCount) * 100, 100) : 0;
  const isComplete = value >= targetCount;
  const habitColor = color || "#3b82f6";

  return (
    <XStack items="center" gap="$3">
      <YStack flex={1} gap="$1">
        <XStack items="center" justify="space-between">
          <Text fontSize="$1" color="$mutedForeground">
            {value}/{targetCount}
          </Text>
          {isComplete && (
            <Text fontSize="$1" fontWeight="500" color="$success">
              Complete
            </Text>
          )}
        </XStack>
        <Progress value={percentage} height={8} bg="$muted" rounded={9999}>
          <Progress.Indicator
            transition="medium"
            style={{
              backgroundColor: isComplete ? COMPLETE_GREEN : habitColor,
            }}
          />
        </Progress>
      </YStack>
      {streak > 0 ? <StreakBadge count={streak} size="$2" /> : null}
    </XStack>
  );
}
