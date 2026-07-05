import { Flame } from "@tamagui/lucide-icons-2";
import { GradientSurface, Text, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import {
  getNextTier,
  getTierProgressDetail,
  getMultiplierLabel,
} from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

interface LevelProgressProps {
  userLight: UserLight;
}

export function LevelProgress({ userLight }: LevelProgressProps) {
  const { totalLight, currentTier, currentTitle, perfectDayStreak } = userLight;
  const nextTier = getNextTier(currentTier);
  // One helper drives both the bar fill and its caption so they always encode
  // the same within-tier fraction (the caption used to show total/nextThreshold
  // — a different denominator than the bar, e.g. bar 10% vs caption "60/150").
  const { percent, earnedInTier, tierSize } = getTierProgressDetail(
    totalLight,
    currentTier,
  );

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
          width={`${percent}%`}
        />
      </View>

      {/* Bottom row: within-tier progress toward the next tier — streak.
          Caption matches the bar's fraction (earnedInTier / tierSize). */}
      <XStack items="center" justify="space-between">
        <Text fontSize="$1" color="$mutedForeground" style={tabularNums}>
          {nextTier
            ? `${earnedInTier.toLocaleString()} / ${tierSize.toLocaleString()} Light to ${nextTier.title}`
            : `${totalLight.toLocaleString()} Light (Max)`}
        </Text>
        {perfectDayStreak > 0 && (
          <XStack items="center" gap="$1">
            {/* lucide-icons-2 reads its own `color` (no CSS cascade); raw gold
                hex, not a kit token. */}
            <Flame size={12} color="#f59e0b" />
            <Text fontSize="$1" color="$mutedForeground" style={tabularNums}>
              {getMultiplierLabel(perfectDayStreak)} streak {perfectDayStreak}d
            </Text>
          </XStack>
        )}
      </XStack>
    </YStack>
  );
}
