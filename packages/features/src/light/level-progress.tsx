import { Flame } from "@tamagui/lucide-icons-2";
import { GradientSurface, Text, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import { getNextTier, getTierProgress } from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

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
          uses $muted and the fill is the kit's cross-platform GradientSurface
          (CSS gradient on web, expo-linear-gradient on native). angle=90 →
          left→right (= the old `linear-gradient(to right, …)`). */}
      <View
        height={8}
        width="100%"
        overflow="hidden"
        rounded={9999}
        bg="$muted"
      >
        <GradientSurface
          colors={["#f59e0b", "#fbbf24"]}
          angle={90}
          height="100%"
          rounded={9999}
          transition="slow"
          width={`${progress}%`}
        />
      </View>

      {/* Bottom row: light count — streak */}
      <XStack items="center" justify="space-between">
        <Text fontSize="$1" color="$mutedForeground" style={tabularNums}>
          {nextTier
            ? `${totalLight.toLocaleString()} / ${nextTier.lightRequired.toLocaleString()} Light`
            : `${totalLight.toLocaleString()} Light (Max)`}
        </Text>
        {perfectDayStreak > 0 && (
          <XStack items="center" gap="$1">
            {/* lucide-icons-2 reads its own `color` (no CSS cascade); raw gold
                hex, not a kit token. */}
            <Flame size={12} color="#f59e0b" />
            <Text fontSize="$1" color="$mutedForeground" style={tabularNums}>
              {getMultiplierDisplay(perfectDayStreak)} streak {perfectDayStreak}
              d
            </Text>
          </XStack>
        )}
      </XStack>
    </YStack>
  );
}
