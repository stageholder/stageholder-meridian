// apps/mobile/app/(authed)/journey.tsx
//
// Journey — the gamification surface, native mirror of the PWA's /journey
// (apps/pwa/src/routes/_app/journey.tsx) over the same shared
// @repo/features/light views. Composition, top to bottom:
//
//   HERO       — amber-washed card: pulsing StarVisual (tier star), current
//                title, total Light, the LevelProgress bar.
//   STATS      — JourneyStats (total light · perfect days · longest streak ·
//                multiplier).
//   TIER NOTE  — the current tier's long description (the PWA's centered
//                paragraph).
//   STREAKS    — JourneyStreaks (perfect day + the three ring streaks).
//   THE PATH   — JourneyTierMap, the redesigned vertical ascent (native
//                variant): walked gold path, hero "YOU ARE HERE" level card
//                with live Light progress, dimmed future levels.
//   FEED       — JourneyFeed with "Show more" pagination (same limits as the
//                PWA wrapper).
//   CHART      — JourneyLightChart (shared cross-platform view, fed by
//                useLightTrend) — the 14-day cumulative Light trend.
//   LEVEL-UP   — LevelUpCelebration overlay when currentTier increases
//                mid-session (shared `useLevelUp` ref-compare hook, also
//                mounted on the Today dashboard).
//
// Deliberately NOT ported: the Today activity rings (the Today tab already
// renders them one tap away).
//
// Pushed (native stack) from the Today level card / Settings; the stack
// header owns title + back, so Back returns wherever the user came from.

import { Button, Spinner, Text, View, XStack, YStack } from "@stageholder/ui";
import {
  JourneyFeed,
  JourneyStats,
  JourneyStreaks,
  JourneyTierMap,
  LevelProgress,
  LevelUpCelebration,
  StarVisual,
} from "@repo/features/light";
import { JourneyLightChart } from "@repo/features/charts";
import { LIGHT_TIERS, type UserLight } from "@repo/core/types/light";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { ScreenScroll } from "@/components/screen-scroll";
import { useLightEvents, useUserLight } from "@/lib/api";
import { useLevelUp } from "@/lib/use-level-up";
import { useLightTrend } from "@/lib/use-light-trend";

const FEED_INITIAL = 10;
const FEED_STEP = 20;

export default function JourneyScreen() {
  const lightQuery = useUserLight();
  const userLight = lightQuery.data;
  const { levelUpTier, dismiss } = useLevelUp(userLight);

  const [feedLimit, setFeedLimit] = useState(FEED_INITIAL);
  const eventsQuery = useLightEvents(feedLimit, 0);

  // PERF: the StarVisual pulse is a 1.5s setInterval — the app's only
  // recurring timer. freezeOnBlur suspends the RENDER of a blurred tab but
  // not its timers, so gate `animate` on focus: blurred → interval unmounts
  // (the star's effect cleans it up), focused → pulse resumes.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const lightTrend = useLightTrend();
  // Array.isArray (not just ?? []): the query cache is PERSISTED to
  // AsyncStorage, so a stale entry written by an older hook version can
  // rehydrate with a different shape and render before the refetch lands.
  // Never hand the feed anything but a real array.
  const events = Array.isArray(eventsQuery.data) ? eventsQuery.data : [];

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([lightQuery.refetch(), eventsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
    // refetch fns are referentially stable in RQ v5.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightQuery.refetch, eventsQuery.refetch]);

  return (
    <YStack flex={1} bg="$background">
      {userLight ? (
        <ScreenScroll
          stackScreen
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={refresh}
        >
          <YStack gap="$5" px="$4" pt="$2" pb="$10">
            {/* ---- Hero — star · title · total Light · progress ---- */}
            <YStack
              items="center"
              rounded="$6"
              borderWidth={1}
              borderColor="rgba(245, 158, 11, 0.22)"
              bg="rgba(245, 158, 11, 0.05)"
              px="$5"
              pt="$6"
              pb="$5"
              enterStyle={{ opacity: 0, y: 12 }}
              transition="medium"
            >
              <StarVisual
                tier={userLight.currentTier}
                size="xl"
                animate={focused}
              />
              <Text
                mt="$3"
                fontSize="$8"
                fontWeight="700"
                letterSpacing={-0.5}
                color="$color"
              >
                {userLight.currentTitle}
              </Text>
              <Text mt="$0.5" fontSize="$3" color="$mutedForeground">
                {userLight.totalLight.toLocaleString()} Light earned
              </Text>
              <View mt="$5" width="100%">
                <LevelProgress userLight={userLight} />
              </View>
            </YStack>

            {/* ---- Quick stats ---- */}
            <JourneyStats userLight={userLight} />

            {/* ---- Current tier's long description ---- */}
            <Text
              fontSize="$3"
              color="$mutedForeground"
              text="center"
              px="$2"
              lineHeight={20}
            >
              {LIGHT_TIERS[userLight.currentTier - 1]?.description}
            </Text>

            {/* ---- Streaks ---- */}
            <YStack gap="$3">
              <SectionLabel>Streaks</SectionLabel>
              <JourneyStreaks userLight={userLight} />
            </YStack>

            {/* ---- Light earned (14-day cumulative trend) — the shared
                   chart view over the kit's cross-platform AreaChart. ---- */}
            <YStack gap="$3">
              <SectionLabel>Light Earned</SectionLabel>
              <JourneyLightChart
                data={lightTrend.data}
                isLoading={lightTrend.isLoading}
              />
            </YStack>

            {/* ---- The path (redesigned vertical tier map) ---- */}
            <YStack gap="$3">
              <SectionLabel>The Path</SectionLabel>
              <JourneyTierMap
                currentTier={userLight.currentTier}
                totalLight={userLight.totalLight}
                animateStars={focused}
              />
            </YStack>

            {/* ---- Recent Light feed ---- */}
            <YStack gap="$3">
              <SectionLabel>Recent Light</SectionLabel>
              <JourneyFeed
                events={events}
                isLoading={eventsQuery.isLoading}
                canLoadMore={events.length >= feedLimit}
                onLoadMore={() => setFeedLimit((l) => l + FEED_STEP)}
              />
            </YStack>
          </YStack>
        </ScreenScroll>
      ) : lightQuery.isError ? (
        <YStack flex={1} items="center" justify="center" gap="$3" p="$6">
          <Text fontSize="$4" color="$color" text="center">
            Couldn&apos;t load your journey.
          </Text>
          <Button
            size="sm"
            variant="outlined"
            onPress={() => void lightQuery.refetch()}
          >
            Try again
          </Button>
        </YStack>
      ) : (
        <View flex={1} items="center" justify="center">
          <Spinner size="large" />
        </View>
      )}

      {levelUpTier ? (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      ) : null}
    </YStack>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      fontSize="$3"
      fontWeight="600"
      color="$mutedForeground"
      textTransform="uppercase"
      letterSpacing={0.5}
    >
      {children}
    </Text>
  );
}
