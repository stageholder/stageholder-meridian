import { useEffect, useState } from "react";
import { Flame } from "@tamagui/lucide-icons-2/icons/Flame";
import { GradientSurface, Text, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import {
  estimateDaysToLight,
  formatDaysEta,
  getNextTier,
  getTierProgressDetail,
  getMultiplierLabel,
} from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

interface LevelProgressProps {
  userLight: UserLight;
  /**
   * Hold the bar EMPTY (no fill, no tween). Hosts park the card while its
   * screen is blurred so the next focus sweeps 0 → percent instead of
   * flashing the finished bar first.
   */
  parked?: boolean;
  /**
   * Average Light/day (`getLightPace`). When > 0 and a next tier exists, a
   * third line projects when it lands ("Radiant in ~3 days at your pace").
   * Omitted on compact hosts like the Today card.
   */
  paceLightPerDay?: number;
}

export function LevelProgress({
  userLight,
  parked = false,
  paceLightPerDay = 0,
}: LevelProgressProps) {
  const { totalLight, currentTier, currentTitle, perfectDayStreak } = userLight;
  const nextTier = getNextTier(currentTier);
  // One helper drives both the bar fill and its caption so they always encode
  // the same within-tier fraction (the caption used to show total/nextThreshold
  // — a different denominator than the bar, e.g. bar 10% vs caption "60/150").
  const { percent, earnedInTier, tierSize } = getTierProgressDetail(
    totalLight,
    currentTier,
  );
  const eta = nextTier
    ? estimateDaysToLight(totalLight, nextTier.lightRequired, paceLightPerDay)
    : null;
  const [fill, setFill] = useState(0);
  useEffect(() => {
    if (parked) {
      setFill(0);
      return;
    }
    const t = setTimeout(() => setFill(percent), 60);
    return () => clearTimeout(t);
  }, [percent, parked]);

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
          // Fill from EMPTY on mount (and on every remount — the Today screen
          // re-keys this card per visit): `fill` starts at 0 and settles to
          // `percent` a tick later, so the gold bar sweeps in instead of
          // appearing full. Later value changes animate from the current fill.
          width={`${fill}%`}
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
      {nextTier && eta !== null ? (
        <Text fontSize="$1" color="$mutedForeground" style={tabularNums}>
          {eta === 0
            ? `${nextTier.title} is within reach today.`
            : `${nextTier.title} in about ${formatDaysEta(eta)} at your pace.`}
        </Text>
      ) : null}
    </YStack>
  );
}
