// src/light/journey-tier-map.native.tsx
//
// NATIVE journey tier map. The web sibling (`journey-tier-map.tsx`) drives a
// horizontal snap-scroll rail with DOM-only machinery — `useRef<HTMLDivElement>`,
// `el.offsetLeft/offsetWidth`, `container.scrollTo({ behavior:"smooth" })` and
// the CSS `scroll-snap-type`/`scrollbar-width` style hatches — none of which
// exist on React Native. So native gets its own implementation via a horizontal
// <FlatList>.
//
// Parity, by design:
//  - Same `{ currentTier }` contract and same per-tier visual states
//    (completed / current / future), the gold "current" highlight, the faint
//    future fade, the connector bar, the "YOU" badge, and the StarVisual.
//  - Snap-to-card: FlatList `snapToInterval` (card width + gap) is the native
//    analog of CSS scroll-snap.
//  - Auto-center on the current tier: instead of measuring DOM offsets, we use
//    a fixed-width card + `getItemLayout` and scroll to the current index
//    centered, which is deterministic because every card is the same width.
//
// `StarVisual` resolves to `star-visual.native.tsx` via the platform-suffix
// split (relative import → Metro substitution).

import { useEffect, useRef } from "react";
import { FlatList } from "react-native";
import { Text, View, YStack } from "@stageholder/ui";
import { StarVisual } from "./star-visual";
import { LIGHT_TIERS, type LightTier } from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

interface JourneyTierMapProps {
  currentTier: number;
}

// Card geometry — kept in JS (not CSS) so `snapToInterval` / `getItemLayout`
// can compute exact offsets. CARD_WIDTH mirrors the web file's `width={100}`;
// GAP mirrors its `gap="$3"` (12px) rail spacing.
const CARD_WIDTH = 100;
const GAP = 12;
const SNAP = CARD_WIDTH + GAP;

export function JourneyTierMap({ currentTier }: JourneyTierMapProps) {
  const listRef = useRef<FlatList<LightTier>>(null);

  // Center the current tier on mount / when it changes. With fixed-width cards
  // the centered offset is purely arithmetic — no layout measurement needed.
  // `viewPosition: 0.5` asks FlatList to center the item in the viewport.
  const currentIndex = LIGHT_TIERS.findIndex((t) => t.tier === currentTier);
  useEffect(() => {
    if (currentIndex < 0) return;
    // Defer to the next frame so the list has laid out before we scroll.
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: currentIndex,
        viewPosition: 0.5,
        animated: true,
      });
    }, 0);
    return () => clearTimeout(id);
  }, [currentIndex]);

  return (
    <View position="relative">
      <FlatList
        ref={listRef}
        data={LIGHT_TIERS}
        horizontal
        keyExtractor={(t) => String(t.tier)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: GAP, paddingTop: 16, paddingBottom: 12 }}
        // Every card is CARD_WIDTH wide + GAP, so the offset is deterministic —
        // this lets scrollToIndex work without an onScrollToIndexFailed dance.
        getItemLayout={(_data, index) => ({
          length: SNAP,
          offset: SNAP * index,
          index,
        })}
        renderItem={({ item: tier, index: i }) => {
          const isCompleted = tier.tier < currentTier;
          const isCurrent = tier.tier === currentTier;
          const isFuture = tier.tier > currentTier;

          return (
            <YStack
              position="relative"
              items="center"
              gap="$2"
              rounded="$lg"
              borderWidth={1}
              p="$4"
              width={CARD_WIDTH}
              transition="medium"
              // Base chrome from kit tokens; the gold "current" highlight and the
              // faint future border have no token, so they ride the style hatch
              // (raw rgba — intentionally theme-independent, like the web file).
              borderColor="$borderColor"
              bg={isCompleted ? "$muted" : "transparent"}
              opacity={isFuture ? 0.5 : 1}
              style={
                isCurrent
                  ? {
                      borderColor: "rgba(245, 158, 11, 0.5)",
                      backgroundColor: "rgba(245, 158, 11, 0.05)",
                    }
                  : isFuture
                    ? { borderColor: "rgba(223, 230, 235, 0.4)" }
                    : undefined
              }
            >
              {/* Connector bar to the next tier — gold once completed. On native
                  it sits in the GAP between cards; translate by its own width to
                  bridge into the spacing. */}
              {i < LIGHT_TIERS.length - 1 && (
                <View
                  position="absolute"
                  r={0}
                  t="50%"
                  height={1}
                  width={GAP}
                  bg={tier.tier < currentTier ? undefined : "$borderColor"}
                  style={{
                    transform: [{ translateX: GAP }],
                    ...(tier.tier < currentTier
                      ? { backgroundColor: "rgba(245, 158, 11, 0.4)" }
                      : null),
                  }}
                />
              )}
              <StarVisual tier={tier.tier} size="sm" animate={isCurrent} />
              <YStack items="center">
                <Text
                  fontSize="$1"
                  fontWeight="600"
                  text="center"
                  color={isFuture ? "$mutedForeground" : "$color"}
                  style={isCurrent ? { color: "#d97706" } : undefined}
                >
                  {tier.title}
                </Text>
                <Text
                  mt={1}
                  fontSize={10}
                  color="$mutedForeground"
                  text="center"
                  style={tabularNums}
                >
                  {tier.lightRequired.toLocaleString()} Light
                </Text>
              </YStack>
              {isCurrent && (
                // "YOU" badge — gold marker, no token (style hatch).
                <View
                  position="absolute"
                  t={-6}
                  r={8}
                  rounded={9999}
                  px="$1.5"
                  py={2}
                  style={{ backgroundColor: "#f59e0b" }}
                >
                  <Text
                    fontSize={9}
                    fontWeight="700"
                    style={{ color: "#ffffff" }}
                  >
                    YOU
                  </Text>
                </View>
              )}
            </YStack>
          );
        }}
      />
    </View>
  );
}
