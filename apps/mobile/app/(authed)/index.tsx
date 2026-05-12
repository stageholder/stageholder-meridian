// apps/mobile/app/(authed)/index.tsx
//
// Today — the dashboard. Aesthetic direction is "observatory":
//
//   - Calm dark-navy field
//   - ActivityRings as the central celestial widget (3 daily metrics)
//   - PulsingFire at the rings' center as "the light you've earned today"
//   - Streak strip + inline TodayTodos + HabitSummary panels below
//   - FAB pinned bottom-right for quick capture
//
// Mirrors the PWA dashboard's information architecture
// (apps/pwa/app/app/page.tsx): rings → today's todos panel → today's habits
// panel. The mobile layout is a single column instead of the PWA's bento
// grid — same data, same priorities, different geometry.

import { useUser } from "@stageholder/sdk/react-native";
import {
  ActivityRings,
  Banner,
  Button,
  Card,
  FAB,
  H2,
  Paragraph,
  PullToRefresh,
  StreakBadge,
  Text,
  XStack,
  YStack,
  useHaptic,
} from "@stageholder/ui";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable } from "react-native";
import type { LightTier } from "@repo/core/types";
import { Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HabitSummaryPanel } from "@/components/dashboard/HabitSummaryPanel";
import { LevelUpCelebration } from "@/components/LevelUpCelebration";
import { LightEarnedChart } from "@/components/dashboard/LightEarnedChart";
import { TodayTodosPanel } from "@/components/dashboard/TodayTodosPanel";
import { WeeklyActivityChart } from "@/components/dashboard/WeeklyActivityChart";
import { PulsingFire } from "@/components/PulsingFire";
import { LIGHT_TIERS } from "@repo/core/types";
import { useEffect, useRef } from "react";
import {
  useHabits,
  useJournals,
  useTodayHabitProgress,
  useTodos,
  useUserLight,
} from "@/lib/api";
import { greeting, todayLabel } from "@/lib/mock-data";
import { localDateKey } from "@/lib/streak";

// Fallback target used until userLight resolves on first load. Profile
// screen lets users tune the real value (PATCH /light/targets).
const DEFAULT_WORD_TARGET = 200;
const DEFAULT_TODO_TARGET = 5;

export default function TodayScreen() {
  const { user } = useUser();
  const router = useRouter();
  const haptic = useHaptic();

  const today = localDateKey();

  // ---- Queries ----
  const todosQuery = useTodos();
  const habitsQuery = useHabits();
  const journalsQuery = useJournals({ startDate: today, endDate: today });
  const habitProgress = useTodayHabitProgress();
  const lightQuery = useUserLight();

  const isLoading =
    todosQuery.isLoading || habitsQuery.isLoading || journalsQuery.isLoading;
  const error = todosQuery.error ?? habitsQuery.error ?? journalsQuery.error;

  // ---- Level-up detection ----
  // Watch UserLight.currentTier; when it crosses up, fire the celebration
  // overlay with the new tier's metadata.
  const [celebratingTier, setCelebratingTier] = useState<LightTier | null>(
    null,
  );
  const prevTierRef = useRef<number | null>(null);
  useEffect(() => {
    const tier = lightQuery.data?.currentTier;
    if (tier == null) return;
    const prev = prevTierRef.current;
    prevTierRef.current = tier;
    if (prev != null && tier > prev) {
      const t = LIGHT_TIERS[tier - 1];
      if (t) setCelebratingTier(t);
    }
  }, [lightQuery.data?.currentTier]);

  // ---- Refresh ----
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        todosQuery.refetch(),
        habitsQuery.refetch(),
        journalsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // ---- Derived stats for rings ----
  const todoStats = useMemo(() => {
    const todos = todosQuery.data ?? [];
    const todayTodos = todos.filter((t) => {
      if (t.status === "done") {
        return t.updatedAt.slice(0, 10) === today;
      }
      const due = t.dueDate?.slice(0, 10);
      const doD = t.doDate?.slice(0, 10);
      return (
        (due !== undefined && due <= today) ||
        (doD !== undefined && doD <= today)
      );
    });
    return {
      done: todayTodos.filter((t) => t.status === "done").length,
      total: todayTodos.length,
    };
  }, [todosQuery.data, today]);

  const journalTarget =
    lightQuery.data?.journalTargetDailyWords ?? DEFAULT_WORD_TARGET;
  const todoTarget = lightQuery.data?.todoTargetDaily ?? DEFAULT_TODO_TARGET;

  const journalStats = useMemo(() => {
    const entries = journalsQuery.data ?? [];
    return {
      words: entries.reduce((sum, e) => sum + (e.wordCount ?? 0), 0),
      target: journalTarget,
    };
  }, [journalsQuery.data, journalTarget]);

  const habitStats = habitProgress.data ?? {
    doneToday: 0,
    totalScheduledToday: 0,
    bestStreak: 0,
  };

  const rings = [
    {
      value: habitStats.doneToday,
      max: Math.max(1, habitStats.totalScheduledToday),
      color: "#ef4444",
      label: "Habits",
    },
    {
      value: journalStats.words,
      max: Math.max(1, journalStats.target),
      color: "#f59e0b",
      label: "Words",
    },
    {
      // Use the user's target as the ring's max — "done today" out of
      // "what you planned for today" matches the light system's
      // todoTargetDaily semantics (apps/api/src/modules/light/light.dto.ts).
      value: todoStats.done,
      max: Math.max(1, Math.max(todoStats.total, todoTarget)),
      color: "#3b82f6",
      label: "Todos",
    },
  ];

  function handleQuickAdd() {
    haptic.impact("medium");
    Alert.alert("Quick add", "Pick a surface to capture into.", [
      { text: "Todos", onPress: () => router.push("/todos") },
      { text: "Habits", onPress: () => router.push("/habits") },
      { text: "Journal", onPress: () => router.push("/journal") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          <YStack gap="$5" px="$5" pt="$4" pb={96}>
            {/* ---- Header ---- */}
            <YStack gap="$1">
              <XStack items="center" justify="space-between">
                <Paragraph
                  fontFamily="$mono"
                  fontSize={11}
                  letterSpacing={2}
                  textTransform="uppercase"
                  color="$color11"
                >
                  {todayLabel()}
                </Paragraph>
                {lightQuery.data ? (
                  <Pressable onPress={() => router.push("/profile")}>
                    <XStack items="center" gap="$1.5">
                      <Text fontSize="$1" color="$color11" fontFamily="$mono">
                        {lightQuery.data.totalLight.toLocaleString()}
                      </Text>
                      <Text
                        fontSize={10}
                        letterSpacing={1.6}
                        color="$color11"
                        fontWeight="600"
                        fontFamily="$mono"
                      >
                        · {lightQuery.data.currentTitle?.toUpperCase()}
                      </Text>
                    </XStack>
                  </Pressable>
                ) : null}
              </XStack>
              <H2 color="$color12">
                {greeting()}
                {user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
              </H2>
            </YStack>

            {/* ---- Error banner ---- */}
            {error ? (
              <Banner intent="danger">
                <Banner.Title>Couldn't load today</Banner.Title>
                <Banner.Description>
                  {(error as Error).message ?? "Something went wrong."}
                </Banner.Description>
                <XStack pt="$2">
                  <Button intent="secondary" size="$2" onPress={handleRefresh}>
                    Try again
                  </Button>
                </XStack>
              </Banner>
            ) : null}

            {/* ---- Activity rings + legend ---- */}
            <Card>
              <Card.Body py="$5" gap="$4" items="center">
                <ActivityRings size={196} rings={rings}>
                  <PulsingFire size={48} />
                </ActivityRings>
                <XStack gap="$5" flexWrap="wrap" justify="center">
                  {rings.map((r) => (
                    <YStack key={r.label} items="center" gap={2} minWidth={72}>
                      <XStack items="center" gap="$1.5">
                        <YStack
                          width={8}
                          height={8}
                          rounded={4}
                          bg={r.color as never}
                        />
                        <Text
                          fontSize={10}
                          letterSpacing={1.5}
                          textTransform="uppercase"
                          color="$color11"
                          fontWeight="600"
                        >
                          {r.label}
                        </Text>
                      </XStack>
                      <Text fontSize="$5" fontWeight="700" color="$color12">
                        {isLoading ? "—" : r.value}
                        <Text fontSize="$2" color="$color11" fontWeight="500">
                          {" / "}
                          {r.max}
                        </Text>
                      </Text>
                    </YStack>
                  ))}
                </XStack>
              </Card.Body>
            </Card>

            {/* ---- Streak strip ---- */}
            <XStack
              items="center"
              gap="$3"
              p="$4"
              rounded="$3"
              bg="$color2"
              borderWidth={1}
              borderColor="$color6"
            >
              <StreakBadge
                count={habitStats.bestStreak}
                size="$4"
                label={habitStats.bestStreak === 1 ? "day" : "day streak"}
              />
              <Paragraph
                flex={1}
                fontSize="$2"
                color="$color11"
                lineHeight="$2"
              >
                {habitStats.bestStreak === 0
                  ? "Check in a habit today to start a streak."
                  : habitStats.totalScheduledToday - habitStats.doneToday > 0
                    ? `${habitStats.totalScheduledToday - habitStats.doneToday} habit${habitStats.totalScheduledToday - habitStats.doneToday === 1 ? "" : "s"} left to keep the chain.`
                    : todoStats.total - todoStats.done > 0
                      ? `Habits done. ${todoStats.total - todoStats.done} todo${todoStats.total - todoStats.done === 1 ? "" : "s"} for today.`
                      : "All clear today. Take a breath."}
              </Paragraph>
            </XStack>

            {/* ---- Today's todos (mirrors PWA today-todos.tsx) ---- */}
            <TodayTodosPanel />

            {/* ---- Habits today (mirrors PWA habit-summary.tsx) ---- */}
            <HabitSummaryPanel />

            {/* ---- Weekly activity bar chart ---- */}
            <WeeklyActivityChart />

            {/* ---- 30-day light earned chart ---- */}
            <LightEarnedChart />
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      <FAB
        icon={<PlusGlyph />}
        placement="bottom-right"
        b={88}
        onPress={handleQuickAdd}
      />

      {celebratingTier ? (
        <LevelUpCelebration
          open={!!celebratingTier}
          tier={celebratingTier}
          onClose={() => setCelebratingTier(null)}
        />
      ) : null}
    </YStack>
  );
}

function PlusGlyph() {
  return (
    <Text color="white" fontSize={28} fontWeight="300" lineHeight={28}>
      +
    </Text>
  );
}
