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
//   LEVEL-UP   — LevelUpCelebration overlay when currentTier increases
//                mid-session (ported use-level-up ref-compare hook, inline).
//
// Deliberately NOT ported: the PWA's Light chart (a web recharts surface)
// and the Today rings (the Today tab already renders them one tap away).
//
// Reached from the Today dashboard's level-progress card (tap), not a tab —
// registered with `href: null`, back chevron returns to Today.

import {
  IconButton,
  ScrollView,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import {
  JourneyFeed,
  JourneyStats,
  JourneyStreaks,
  JourneyTierMap,
  LevelProgress,
  LevelUpCelebration,
  StarVisual,
} from "@repo/features/light";
import { LIGHT_TIERS, type UserLight } from "@repo/core/types/light";
import { ChevronLeft } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { useLightEvents, useUserLight } from "@/lib/api";

const FEED_INITIAL = 10;
const FEED_STEP = 20;

/** Port of the PWA's use-level-up: fire the celebration only on an observed
 *  tier INCREASE within this session (ref-compare, not on first load). */
function useLevelUp(userLight: UserLight | undefined) {
  const prevTier = useRef<number | null>(null);
  const [levelUpTier, setLevelUpTier] = useState<number | null>(null);

  useEffect(() => {
    if (!userLight) return;
    if (prevTier.current !== null && userLight.currentTier > prevTier.current) {
      setLevelUpTier(userLight.currentTier);
    }
    prevTier.current = userLight.currentTier;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLight?.currentTier]);

  return { levelUpTier, dismiss: () => setLevelUpTier(null) };
}

export default function JourneyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lightQuery = useUserLight();
  const userLight = lightQuery.data;
  const { levelUpTier, dismiss } = useLevelUp(userLight);

  const [feedLimit, setFeedLimit] = useState(FEED_INITIAL);
  const eventsQuery = useLightEvents(feedLimit, 0);
  // Array.isArray (not just ?? []): the query cache is PERSISTED to
  // AsyncStorage, so a stale entry written by an older hook version can
  // rehydrate with a different shape and render before the refetch lands.
  // Never hand the feed anything but a real array.
  const events = Array.isArray(eventsQuery.data) ? eventsQuery.data : [];

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Header: back to Today · centered title. */}
        <XStack items="center" px="$2" py="$2" position="relative">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Back to today"
            onPress={() => router.navigate("/")}
          >
            <ChevronLeft size={20} />
          </IconButton>
          <Text
            position="absolute"
            l={0}
            r={0}
            text="center"
            pointerEvents="none"
            fontSize="$5"
            fontWeight="600"
            color="$color"
          >
            Journey
          </Text>
        </XStack>

        {userLight ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              pb: BOTTOM_NAV_CLEARANCE + insets.bottom,
            }}
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
                <StarVisual tier={userLight.currentTier} size="xl" />
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

              {/* ---- The path (redesigned vertical tier map) ---- */}
              <YStack gap="$3">
                <SectionLabel>The Path</SectionLabel>
                <JourneyTierMap
                  currentTier={userLight.currentTier}
                  totalLight={userLight.totalLight}
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
          </ScrollView>
        ) : (
          <View flex={1} items="center" justify="center">
            <Spinner size="large" />
          </View>
        )}
      </SafeAreaView>

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
