import { Flame } from "lucide-react";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import { getNextTier, getTierProgress } from "@repo/core/types/light";

interface LevelProgressProps {
  userLight: UserLight;
}

function getMultiplierDisplay(streak: number): string {
  if (streak >= 14) return "3x";
  if (streak >= 10) return "2.5x";
  if (streak >= 7) return "2x";
  if (streak >= 3) return "1.5x";
  return "1x";
}

export function LevelProgress({ userLight }: LevelProgressProps) {
  const { totalLight, currentTier, currentTitle, perfectDayStreak } = userLight;
  const nextTier = getNextTier(currentTier);
  const progress = getTierProgress(totalLight, currentTier);

  return (
    // Layout (margin/width) is owned by the caller via a wrapping View; the
    // component itself just fills its container.
    <YStack width="100%" gap="$2">
      {/* Top row: current title — next title */}
      <XStack items="center" justify="space-between">
        <Text fontSize="$3" fontWeight="600" color="$color">
          {currentTitle}
        </Text>
        {nextTier && (
          <Text fontSize="$3" color="$mutedForeground">
            {nextTier.title}
          </Text>
        )}
      </XStack>

      {/* Progress bar — gold gradient fill has no kit token, so the track
          uses $muted and the fill rides the style escape hatch. */}
      <View
        height={8}
        width="100%"
        overflow="hidden"
        rounded={9999}
        bg="$muted"
      >
        <View
          height="100%"
          rounded={9999}
          transition="slow"
          width={`${progress}%`}
          style={{
            background: "linear-gradient(to right, #f59e0b, #fbbf24)",
          }}
        />
      </View>

      {/* Bottom row: light count — streak */}
      <XStack items="center" justify="space-between">
        <Text
          fontSize="$1"
          color="$mutedForeground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {nextTier
            ? `${totalLight.toLocaleString()} / ${nextTier.lightRequired.toLocaleString()} Light`
            : `${totalLight.toLocaleString()} Light (Max)`}
        </Text>
        {perfectDayStreak > 0 && (
          <XStack items="center" gap="$1">
            <Text lineHeight={0} style={{ color: "#f59e0b" }}>
              <Flame size={12} />
            </Text>
            <Text
              fontSize="$1"
              color="$mutedForeground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {getMultiplierDisplay(perfectDayStreak)} streak {perfectDayStreak}
              d
            </Text>
          </XStack>
        )}
      </XStack>
    </YStack>
  );
}
