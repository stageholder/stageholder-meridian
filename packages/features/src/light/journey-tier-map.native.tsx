// src/light/journey-tier-map.native.tsx
//
// NATIVE journey tier map — a VERTICAL ascent path (the journey-app idiom:
// Duolingo's path, Headspace's course line) replacing the first-pass
// horizontal card rail. Ten levels climb down the screen along a lit
// connector line:
//
//   node column                     card column
//   ───────────                     ───────────────────────────────
//   │  (gold segment = walked)      completed → compact "Reached" row
//   ◉  StarVisual in a tinted well  current   → hero card: YOU ARE HERE,
//   │                                           description, Light progress
//   ○  (hairline = ahead)           future    → dimmed "Unlocks at N" row
//
// Per-level states, level by level (the "level design"):
//   - COMPLETED — walked path: gold connector, softly-lit node well, compact
//     card with the tier name + a check. Quiet; history shouldn't shout.
//   - CURRENT — the hero level: amber-glow card, "TIER N · YOU ARE HERE"
//     kicker, the tier's shortDescription, and (when `totalLight` is given)
//     a live gold progress bar toward the next tier. The star pulses
//     (StarVisual's own breathing animation).
//   - FUTURE — aspirational, not punitive: dimmed node + "Unlocks at N
//     Light" instead of a lock.
//   - MOTION — rows rise in via `enterStyle` + `transition` (Reanimated
//     driver); the current card's glow ring and pulsing star carry the
//     ambient life.
//
// Plain mapped YStack (no FlatList): this renders inside the screen's
// ScrollView — nesting a same-axis VirtualizedList there is an RN error,
// and at exactly 10 static rows virtualization buys nothing.
//
// Web sibling (`journey-tier-map.tsx`) keeps the horizontal snap rail that
// suits a wide desktop page; both share the `{ currentTier, totalLight? }`
// contract.

import { Check } from "@tamagui/lucide-icons-2";
import { GradientSurface, Text, View, XStack, YStack } from "@stageholder/ui";
import { StarVisual } from "./star-visual";
import {
  LIGHT_TIERS,
  getNextTier,
  getTierProgress,
} from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

interface JourneyTierMapProps {
  currentTier: number;
  /**
   * Total Light earned. Optional — when provided, the current level's card
   * shows the live progress bar toward the next tier.
   */
  totalLight?: number;
}

// Gold path + amber chrome — deliberately theme-independent (the journey's
// identity hue, same family as the hero/star gold). Raw rgba per the kit's
// strict color rules.
const GOLD = "#f59e0b";
const PATH_LIT = "rgba(245, 158, 11, 0.45)";
const PATH_DIM = "rgba(148, 163, 184, 0.25)";
const NODE_SIZE = 44;

export function JourneyTierMap({
  currentTier,
  totalLight,
}: JourneyTierMapProps) {
  return (
    <YStack enterStyle={{ opacity: 0 }} transition="medium">
      {LIGHT_TIERS.map((tier, i) => {
        const isCompleted = tier.tier < currentTier;
        const isCurrent = tier.tier === currentTier;
        const isFuture = tier.tier > currentTier;
        const isFirst = i === 0;
        const isLast = i === LIGHT_TIERS.length - 1;
        // Segment ABOVE this node is walked once the node itself is reached;
        // the segment BELOW lights up only after this tier is passed.
        const topLit = tier.tier <= currentTier;
        const bottomLit = tier.tier < currentTier;

        return (
          <XStack
            key={tier.tier}
            gap="$3"
            items="stretch"
            enterStyle={{ opacity: 0, y: 16 }}
            transition="medium"
          >
            {/* ---- Node column: connector · star well · connector ---- */}
            <YStack
              width={NODE_SIZE}
              flexBasis="auto"
              shrink={0}
              items="center"
            >
              <View
                width={2}
                flex={1}
                bg={isFirst ? "transparent" : topLit ? PATH_LIT : PATH_DIM}
              />
              <View
                width={NODE_SIZE}
                height={NODE_SIZE}
                rounded={9999}
                items="center"
                justify="center"
                borderWidth={1.5}
                borderColor={
                  isCurrent
                    ? PATH_LIT
                    : isCompleted
                      ? "rgba(245, 158, 11, 0.25)"
                      : "$borderColor"
                }
                bg={
                  isCurrent
                    ? "rgba(245, 158, 11, 0.14)"
                    : isCompleted
                      ? "rgba(245, 158, 11, 0.07)"
                      : "$muted"
                }
                opacity={isFuture ? 0.55 : 1}
                // Soft halo on the active node only.
                boxShadow={
                  isCurrent ? "0 0 14px rgba(245, 158, 11, 0.35)" : undefined
                }
              >
                <StarVisual tier={tier.tier} size="sm" animate={isCurrent} />
              </View>
              <View
                width={2}
                flex={1}
                bg={isLast ? "transparent" : bottomLit ? PATH_LIT : PATH_DIM}
              />
            </YStack>

            {/* ---- Card column ---- */}
            <YStack flex={1} minW={0} py="$2">
              {isCurrent ? (
                <YStack
                  rounded="$6"
                  borderWidth={1}
                  borderColor={PATH_LIT}
                  bg="rgba(245, 158, 11, 0.06)"
                  p="$3.5"
                  gap="$2"
                  boxShadow="0 2px 12px rgba(245, 158, 11, 0.12)"
                >
                  <Text
                    fontFamily="$mono"
                    fontSize={10}
                    letterSpacing={2}
                    textTransform="uppercase"
                    color={GOLD}
                    fontWeight="700"
                  >
                    Tier {tier.tier} · You are here
                  </Text>
                  <Text fontSize="$6" fontWeight="700" color="$color">
                    {tier.title}
                  </Text>
                  <Text fontSize="$2" color="$mutedForeground" lineHeight={18}>
                    {tier.shortDescription}
                  </Text>
                  <CurrentTierProgress
                    currentTier={tier.tier}
                    totalLight={totalLight}
                  />
                </YStack>
              ) : (
                <XStack
                  rounded="$5"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg={isCompleted ? "$card" : "transparent"}
                  opacity={isFuture ? 0.55 : 1}
                  px="$3"
                  py="$2.5"
                  items="center"
                  gap="$2"
                >
                  <YStack flex={1} minW={0}>
                    <Text
                      fontSize="$3"
                      fontWeight="600"
                      color={isFuture ? "$mutedForeground" : "$color"}
                      numberOfLines={1}
                    >
                      {tier.title}
                    </Text>
                    <Text
                      fontSize={11}
                      color="$mutedForeground"
                      style={tabularNums}
                    >
                      {isCompleted
                        ? "Reached"
                        : `Unlocks at ${tier.lightRequired.toLocaleString()} Light`}
                    </Text>
                  </YStack>
                  {isCompleted ? (
                    <View
                      width={20}
                      height={20}
                      rounded={9999}
                      items="center"
                      justify="center"
                      bg="rgba(245, 158, 11, 0.15)"
                    >
                      <Check size={12} color={GOLD} />
                    </View>
                  ) : (
                    <Text
                      fontSize={11}
                      color="$mutedForeground"
                      style={tabularNums}
                    >
                      T{tier.tier}
                    </Text>
                  )}
                </XStack>
              )}
            </YStack>
          </XStack>
        );
      })}
    </YStack>
  );
}

/** Gold progress strip inside the current level's card — only when the host
 *  supplies `totalLight` and a next tier exists (max tier shows a quiet
 *  "summit" line instead). */
function CurrentTierProgress({
  currentTier,
  totalLight,
}: {
  currentTier: number;
  totalLight?: number;
}) {
  if (totalLight === undefined) return null;
  const nextTier = getNextTier(currentTier);
  if (!nextTier) {
    return (
      <Text fontSize={11} color="$mutedForeground">
        The summit — every Light from here is legacy.
      </Text>
    );
  }
  const progress = getTierProgress(totalLight, currentTier);

  return (
    <YStack gap="$1" mt="$1">
      <View
        height={6}
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
      <XStack items="center" justify="space-between">
        <Text fontSize={11} color="$mutedForeground" style={tabularNums}>
          {totalLight.toLocaleString()} /{" "}
          {nextTier.lightRequired.toLocaleString()} Light
        </Text>
        <Text fontSize={11} color="$mutedForeground">
          Next: {nextTier.title}
        </Text>
      </XStack>
    </YStack>
  );
}
