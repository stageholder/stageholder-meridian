// src/light/journey-tier-map.tsx
//
// WEB journey tier map. This file is web-only — it drives the horizontal rail
// with DOM machinery (`useRef<HTMLDivElement>`, `offsetLeft/offsetWidth`,
// `container.scrollTo`) and CSS scroll-snap / hidden-scrollbar style hatches,
// none of which exist on React Native. Native resolves the sibling
// `journey-tier-map.native.tsx` (a horizontal <FlatList>) via the platform-
// suffix split; keep the `{ currentTier }` contract in sync across both.

import { useRef, useEffect } from "react";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { StarVisual } from "./star-visual";
import { LIGHT_TIERS } from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

interface JourneyTierMapProps {
  currentTier: number;
  /**
   * Total Light earned. Used by the NATIVE sibling (vertical path) to show
   * live progress inside the current level's card; accepted-unused here so
   * the cross-platform contract stays identical (tsc resolves THIS file's
   * types even for native call sites).
   */
  totalLight?: number;
}

export function JourneyTierMap({ currentTier }: JourneyTierMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = currentRef.current;
      const offset =
        el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [currentTier]);

  return (
    <View position="relative">
      {/* Horizontal snap-scroll rail. Snap + hidden-scrollbar have no kit
          token, so they ride the inline-style escape hatch (allowlist:
          scrollbar/scroll-snap). The DOM ref drives programmatic scrolling. */}
      <XStack
        ref={scrollRef as never}
        gap="$3"
        overflow="scroll"
        pt="$4"
        pb="$3"
        style={{
          overflowX: "auto",
          scrollSnapType: "x proximity",
          scrollbarWidth: "none",
        }}
      >
        {LIGHT_TIERS.map((tier, i) => {
          const isCompleted = tier.tier < currentTier;
          const isCurrent = tier.tier === currentTier;
          const isFuture = tier.tier > currentTier;

          return (
            <YStack
              key={tier.tier}
              ref={isCurrent ? (currentRef as never) : undefined}
              position="relative"
              shrink={0}
              items="center"
              gap="$2"
              rounded="$lg"
              borderWidth={1}
              p="$4"
              width={100}
              transition="medium"
              // Base chrome from kit tokens; the gold "current" highlight and
              // the faint future border have no token, so they ride the style
              // override below.
              borderColor="$borderColor"
              bg={isCompleted ? "$muted" : "transparent"}
              opacity={isFuture ? 0.5 : 1}
              style={{
                scrollSnapAlign: "center",
                ...(isCurrent
                  ? {
                      borderColor: "rgba(245, 158, 11, 0.5)",
                      backgroundColor: "rgba(245, 158, 11, 0.05)",
                      boxShadow: "0 1px 2px rgba(245, 158, 11, 0.1)",
                    }
                  : isFuture
                    ? { borderColor: "rgba(223, 230, 235, 0.4)" }
                    : null),
              }}
            >
              {/* Connector line to the next tier — geometry, kept as a thin
                  absolutely-positioned bar (gold when completed). */}
              {i < LIGHT_TIERS.length - 1 && (
                <View
                  position="absolute"
                  r={0}
                  t="50%"
                  height={1}
                  width={12}
                  bg={tier.tier < currentTier ? undefined : "$borderColor"}
                  style={{
                    transform: "translateX(100%)",
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
                  color={
                    isCompleted
                      ? "$color"
                      : isFuture
                        ? "$mutedForeground"
                        : "$color"
                  }
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
        })}
      </XStack>
    </View>
  );
}
