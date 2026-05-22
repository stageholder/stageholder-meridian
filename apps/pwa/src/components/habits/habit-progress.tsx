import { Text, View, XStack, YStack } from "@stageholder/ui";

interface HabitProgressProps {
  value: number;
  targetCount: number;
  color?: string;
  streak: number;
}

// Habit color is a free-form hex chosen per-habit (and the complete-state
// green flash) — neither has a kit token, so the progress fill is painted
// via the `style` escape hatch. The streak pill's warm amber tint likewise
// has no kit token; applied via `style`.
const COMPLETE_GREEN = "#22c55e";
const STREAK_FLAME = "#f97316"; // orange-500

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
        <View height={8} overflow="hidden" rounded={9999} bg="$muted">
          <View
            height="100%"
            rounded={9999}
            transition="medium"
            style={{
              width: `${percentage}%`,
              backgroundColor: isComplete ? COMPLETE_GREEN : habitColor,
              boxShadow: isComplete ? "0 0 8px rgba(34,197,94,0.4)" : undefined,
            }}
          />
        </View>
      </YStack>
      {streak > 0 && (
        <XStack
          items="center"
          gap="$1"
          rounded={9999}
          px="$2"
          py="$0.5"
          style={{ backgroundColor: "rgba(249,115,22,0.12)" }}
        >
          {/* currentColor for the flame stroke comes from this Text's color. */}
          <Text lineHeight={0} style={{ color: STREAK_FLAME }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
          </Text>
          <Text fontSize="$1" fontWeight="600" style={{ color: STREAK_FLAME }}>
            {streak}
          </Text>
        </XStack>
      )}
    </XStack>
  );
}
