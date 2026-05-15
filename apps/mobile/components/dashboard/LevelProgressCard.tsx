// apps/mobile/components/dashboard/LevelProgressCard.tsx
//
// LIGHT JOURNEY pyrometer card. A horizontal heat gauge that quantifies the
// user's progression through the LightTier system.
//
// Visual language is industrial pyrometer:
//
//   - calibrated track with quartile tick notches
//   - heat-gradient fill (yellow → orange → red) matching the ignition
//     palette, so the gauge LITERALLY visualizes the flame from outer to
//     core as you climb
//   - leading flame indicator at the current reading (a hot dot with a
//     radial glow halo, like a pyrometer needle)
//   - monospace tier labels in the chrome
//
// Tapping the card navigates to /profile, where the full tier deck lives.

import {
  Card,
  Paragraph,
  Text,
  XStack,
  YStack,
  useHaptic,
} from "@stageholder/ui";
import { LIGHT_TIERS, getNextTier, getTierProgress } from "@repo/core/types";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { useUserLight } from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

const GAUGE_HEIGHT = 18;
const GAUGE_TRACK = 8;
const QUARTILES = 5; // 0%, 25%, 50%, 75%, 100% → 4 segments, 5 ticks
const FILL_ANIMATION_MS = 1200;

export function LevelProgressCard() {
  const lightQuery = useUserLight();
  const router = useRouter();
  const haptic = useHaptic();

  const userLight = lightQuery.data;
  const currentTier = userLight?.currentTier ?? 1;
  const totalLight = userLight?.totalLight ?? 0;

  const currentTierData =
    LIGHT_TIERS[Math.max(0, currentTier - 1)] ?? LIGHT_TIERS[0]!;
  const nextTierData = getNextTier(currentTier);
  const tierProgress = userLight ? getTierProgress(totalLight, currentTier) : 0;

  // SVG width is measured from layout — gauge fills the card body width.
  const [trackWidth, setTrackWidth] = useState(0);

  // Mount-time fill animation: 0 → tierProgress over FILL_ANIMATION_MS,
  // ease-out cubic. Restarts when tierProgress changes (e.g., after a
  // tier-up the bar resets and refills against the next tier).
  const [animatedPct, setAnimatedPct] = useState(0);
  useEffect(() => {
    if (!userLight) return;
    let raf = 0;
    const start = Date.now();
    const target = tierProgress;
    function step() {
      const t = Math.min(1, (Date.now() - start) / FILL_ANIMATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedPct(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    }
    step();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tierProgress, userLight]);

  function handlePress() {
    haptic.selection();
    router.push("/profile");
  }

  const isMaxTier = nextTierData == null;
  const fillPx = Math.min(trackWidth, (trackWidth * animatedPct) / 100);
  const indicatorVisible = fillPx > GAUGE_TRACK * 0.6;
  const lightToNext = nextTierData
    ? Math.max(0, nextTierData.lightRequired - totalLight)
    : 0;

  return (
    <Pressable onPress={handlePress} accessibilityRole="button">
      <Card>
        <Card.Body py="$4" gap="$3.5">
          {/* Header — context label + tier number */}
          <XStack items="center" justify="space-between">
            <Paragraph
              fontFamily="$mono"
              fontSize={10}
              letterSpacing={1.8}
              textTransform="uppercase"
              color="$color11"
              fontWeight="700"
            >
              Light Journey
            </Paragraph>
            <Text
              fontFamily="$mono"
              fontSize={10}
              letterSpacing={1.8}
              color="$color11"
              fontWeight="700"
            >
              {`TIER ${String(currentTier).padStart(2, "0")} / 10`}
            </Text>
          </XStack>

          {/* Current tier title + light count */}
          <YStack gap="$1">
            <Text
              fontSize="$8"
              fontWeight="700"
              color="$color12"
              lineHeight="$8"
            >
              {currentTierData.title}
            </Text>
            <XStack items="baseline" gap="$2">
              <Text
                fontFamily="$mono"
                fontSize={12}
                color="$color12"
                fontWeight="600"
              >
                {totalLight.toLocaleString()}
              </Text>
              <Text
                fontFamily="$mono"
                fontSize={10}
                color="$color11"
                letterSpacing={1.4}
                textTransform="uppercase"
              >
                light · {tierProgress}%
              </Text>
            </XStack>
          </YStack>

          {/* The pyrometer gauge */}
          <YStack
            height={GAUGE_HEIGHT}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            {trackWidth > 0 ? (
              <Svg width={trackWidth} height={GAUGE_HEIGHT}>
                <Defs>
                  <SvgLinearGradient
                    id="heat"
                    x1="0"
                    y1="0"
                    x2={trackWidth}
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0%" stopColor={IGNITION.journal.base} />
                    <Stop offset="55%" stopColor={IGNITION.habit.base} />
                    <Stop offset="100%" stopColor={IGNITION.todo.base} />
                  </SvgLinearGradient>
                  <SvgRadialGradient
                    id="flame-glow"
                    cx="50%"
                    cy="50%"
                    rx="50%"
                    ry="50%"
                  >
                    <Stop offset="0%" stopColor="#fff7ed" stopOpacity={0.95} />
                    <Stop
                      offset="55%"
                      stopColor={IGNITION.todo.base}
                      stopOpacity={0.75}
                    />
                    <Stop
                      offset="100%"
                      stopColor={IGNITION.todo.base}
                      stopOpacity={0}
                    />
                  </SvgRadialGradient>
                </Defs>

                {/* Background track */}
                <Rect
                  x={0}
                  y={(GAUGE_HEIGHT - GAUGE_TRACK) / 2}
                  width={trackWidth}
                  height={GAUGE_TRACK}
                  rx={GAUGE_TRACK / 2}
                  fill="rgba(255, 255, 255, 0.05)"
                />

                {/* Heat-gradient fill */}
                {fillPx > 1 ? (
                  <Rect
                    x={0}
                    y={(GAUGE_HEIGHT - GAUGE_TRACK) / 2}
                    width={fillPx}
                    height={GAUGE_TRACK}
                    rx={GAUGE_TRACK / 2}
                    fill="url(#heat)"
                  />
                ) : null}

                {/* Quartile tick notches — calibration marks on the gauge */}
                {Array.from({ length: QUARTILES }).map((_, i) => {
                  const x = (trackWidth * i) / (QUARTILES - 1);
                  return (
                    <Rect
                      key={`tick-${i}`}
                      x={Math.max(0, Math.min(trackWidth - 1, x - 0.5))}
                      y={0}
                      width={1}
                      height={GAUGE_HEIGHT}
                      fill="rgba(255, 255, 255, 0.14)"
                    />
                  );
                })}

                {/* Leading flame indicator — only when fill is wide enough
                    to read as a "needle on the gauge". */}
                {indicatorVisible ? (
                  <>
                    <Circle
                      cx={Math.min(trackWidth - 2, fillPx)}
                      cy={GAUGE_HEIGHT / 2}
                      r={GAUGE_HEIGHT * 0.72}
                      fill="url(#flame-glow)"
                    />
                    <Circle
                      cx={Math.min(trackWidth - 2, fillPx)}
                      cy={GAUGE_HEIGHT / 2}
                      r={GAUGE_HEIGHT * 0.22}
                      fill="#fff7ed"
                    />
                  </>
                ) : null}
              </Svg>
            ) : null}
          </YStack>

          {/* Footer — what's next, or a max-tier banner */}
          {isMaxTier ? (
            <XStack items="center" justify="center" pt="$1">
              <Text
                fontFamily="$mono"
                fontSize={10}
                letterSpacing={2.4}
                textTransform="uppercase"
                color={IGNITION.todo.base}
                fontWeight="800"
              >
                ✦ Maximum tier reached ✦
              </Text>
            </XStack>
          ) : (
            <XStack items="center" justify="space-between" pt="$1">
              <XStack items="center" gap="$1.5">
                <YStack
                  width={6}
                  height={6}
                  rounded={3}
                  bg={IGNITION.habit.base as never}
                />
                <Paragraph
                  fontFamily="$mono"
                  fontSize={10}
                  letterSpacing={1.8}
                  textTransform="uppercase"
                  color="$color11"
                  fontWeight="700"
                >
                  {`Next · ${nextTierData.title}`}
                </Paragraph>
              </XStack>
              <Text
                fontFamily="$mono"
                fontSize={11}
                color="$color12"
                fontWeight="700"
              >
                {`${lightToNext.toLocaleString()} to go`}
              </Text>
            </XStack>
          )}
        </Card.Body>
      </Card>
    </Pressable>
  );
}
