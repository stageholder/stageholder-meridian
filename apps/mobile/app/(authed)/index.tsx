// apps/mobile/app/(authed)/index.tsx
//
// Today — the dashboard. Single-column mobile counterpart of the PWA's bento
// grid (apps/pwa/src/routes/_app/index.tsx): greeting + date → level progress
// → activity rings → habit summary → today's todos → recent journals. Same
// data, same priorities; the layout is a vertical stack instead of a grid.
//
// All presentational cards come from @repo/features (cross-platform, kit-based)
// EXCEPT the activity-rings VISUAL: the features `ActivityRings` hardcodes
// `RING_CATEGORY` colors as CSS vars (`var(--ring-todo)`) which don't resolve
// on React Native (the kit `ActivityRings` even documents "tokens won't resolve
// — use raw colors"). So we render the kit `ActivityRings` directly here with
// the resolved IGNITION hex. See the orchestrator notes for the prop-contract
// mismatch this works around.

import { useUser } from "@stageholder/sdk/react-native";
import {
  ActivityRings,
  Banner,
  Button,
  Card,
  H2,
  Paragraph,
  PullToRefresh,
  Separator,
  Spinner,
  StreakBadge,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import {
  HabitSummary,
  RecentJournals,
  TodayTodos,
  type HabitProgressValue,
} from "@repo/features/dashboard";
import { LevelProgress } from "@repo/features/light";
import type { HabitEntry, Todo } from "@repo/core/types";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";

import {
  apiClient,
  habitKeys,
  useHabits,
  useJournals,
  useTodayHabitProgress,
  useToggleTodo,
  useTodos,
  useUserLight,
} from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";
import { localDateKey } from "@/lib/streak";
import { useJournalCrypto } from "@/lib/journal-crypto";

// Fallback targets used until userLight resolves on first load. The real values
// live on /light/me and are tuned on the web app (PATCH /light/targets).
const DEFAULT_WORD_TARGET = 200;
const DEFAULT_TODO_TARGET = 5;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const router = useRouter();
  const today = localDateKey();

  // ---- Queries ----
  const todosQuery = useTodos();
  const habitsQuery = useHabits();
  // Only today's entries feed the journal ring's word count.
  const journalsQuery = useJournals({ startDate: today, endDate: today });
  const habitProgress = useTodayHabitProgress();
  const lightQuery = useUserLight();

  const toggleTodo = useToggleTodo();

  // Journal entries are encryption-aware: if the account has journal encryption
  // set up and isn't unlocked, the recent-journals card shows a "unlock" hint
  // rather than ciphertext titles. (The journal tab owns the unlock flow.)
  const { isSetup, isUnlocked } = useJournalCrypto();
  const journalLocked = isSetup && !isUnlocked;

  const isLoading =
    todosQuery.isLoading || habitsQuery.isLoading || journalsQuery.isLoading;
  const error = todosQuery.error ?? habitsQuery.error ?? journalsQuery.error;

  // ---- Refresh ----
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        todosQuery.refetch(),
        habitsQuery.refetch(),
        journalsQuery.refetch(),
        lightQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // ---- Ring percentages (computed locally; the PWA's use-activity-rings hook
  //      reads a calendar-month fetch the mobile data layer doesn't expose, so
  //      we derive from the same today-scoped queries the old mobile screen
  //      used). ----
  const todoStats = useMemo(() => {
    const todos = todosQuery.data ?? [];
    const todayTodos = todos.filter((t) => {
      if (t.status === "done") return t.updatedAt.slice(0, 10) === today;
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

  const todoTarget = lightQuery.data?.todoTargetDaily ?? DEFAULT_TODO_TARGET;
  const journalTarget =
    lightQuery.data?.journalTargetDailyWords ?? DEFAULT_WORD_TARGET;

  const journalWords = useMemo(
    () =>
      (journalsQuery.data ?? []).reduce(
        (sum, e) => sum + (e.wordCount ?? 0),
        0,
      ),
    [journalsQuery.data],
  );

  const habitStats = habitProgress.data ?? {
    doneToday: 0,
    totalScheduledToday: 0,
    bestStreak: 0,
  };

  // Ring order is the cross-section of a flame: yellow outer (journal), orange
  // body (habit), red core (todo). The kit's ActivityRings renders index 0 as
  // the outermost ring, so the array is laid out outer→inner. Colors are
  // resolved hex (IGNITION) — required, since the kit won't resolve tokens.
  const rings = [
    {
      value: journalWords,
      max: Math.max(1, journalTarget),
      color: IGNITION.journal.base,
      trackColor: IGNITION.journal.track,
      label: IGNITION.journal.label,
    },
    {
      value: habitStats.doneToday,
      max: Math.max(1, habitStats.totalScheduledToday),
      color: IGNITION.habit.base,
      trackColor: IGNITION.habit.track,
      label: IGNITION.habit.label,
    },
    {
      value: todoStats.done,
      max: Math.max(1, Math.max(todoStats.total, todoTarget)),
      color: IGNITION.todo.base,
      trackColor: IGNITION.todo.track,
      label: IGNITION.todo.label,
    },
  ];

  // HabitSummary wants a Map<habitId, {value,type,targetCountSnapshot}> for
  // TODAY, so a completed habit reads as done (not 0/target). We fetch each
  // habit's entries in parallel via useQueries — these hit the SAME query keys
  // (`habitKeys.entries(id)`) that `useTodayHabitProgress` already populates, so
  // react-query dedups them and there's no extra network cost; we're just
  // reading the cached entries to derive today's per-habit value.
  const habitList = habitsQuery.data ?? [];
  const entriesQueries = useQueries({
    queries: habitList.map((h) => ({
      queryKey: habitKeys.entries(h.id),
      queryFn: async () => {
        const { data } = await apiClient.get<
          { data: HabitEntry[] } | HabitEntry[]
        >(`/habits/${h.id}/entries`);
        return Array.isArray(data) ? data : data.data;
      },
    })),
  });
  const habitProgressMap = useMemo(() => {
    const map = new Map<string, HabitProgressValue>();
    habitList.forEach((h, i) => {
      const entries = entriesQueries[i]?.data ?? [];
      // Aggregate any entries dated today (a habit can have multiple value-1
      // check-ins; the resolver sums them) into one progress value.
      const todayEntries = entries.filter(
        (e) => e.date.split("T")[0] === today,
      );
      if (todayEntries.length === 0) return;
      const value = todayEntries.reduce((sum, e) => sum + (e.value ?? 0), 0);
      // Type precedence: an explicit skip/fail wins over a plain completion.
      const type =
        todayEntries.find((e) => e.type === "skip" || e.type === "fail")
          ?.type ?? todayEntries[0]?.type;
      map.set(h.id, {
        value,
        type,
        targetCountSnapshot: todayEntries[0]?.targetCountSnapshot,
      });
    });
    return map;
    // `entriesQueries` is a fresh array reference each render, so this memo
    // effectively recomputes per render — fine for a short list (it's a cheap
    // reduce). Keying it on the data references would need a stable hash we
    // don't have here; the recompute cost isn't worth that complexity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitList, today, entriesQueries]);

  function handleToggleTodo(todo: Todo) {
    toggleTodo.mutate({ id: todo.id, status: todo.status });
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* PullToRefresh.native IS the scroller (it renders its own ScrollView
            + RefreshControl), so its child is the padded content column — NOT a
            nested ScrollView (that would break the pull gesture). */}
        <PullToRefresh
          refreshing={refreshing}
          onRefresh={handleRefresh}
          // Clearance for the floating BottomNav capsule (PWA shell parity).
          // `contentContainerStyle` exists only on the .native variant; tsc
          // resolves the web types, so it rides a spread cast.
          {...({
            contentContainerStyle: {
              paddingBottom: BOTTOM_NAV_CLEARANCE + insets.bottom,
            },
          } as object)}
        >
          <YStack gap="$5" px="$4" pt="$4" pb="$8">
            {/* ---- Header: date + greeting ---- */}
            <YStack gap="$1">
              <Paragraph
                fontFamily="$mono"
                fontSize={11}
                letterSpacing={2}
                color="$mutedForeground"
              >
                {todayLabel()}
              </Paragraph>
              <H2 color="$color">
                {greeting()}
                {user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
              </H2>
            </YStack>

            {/* ---- Error banner ---- */}
            {error ? (
              <Banner intent="danger">
                <Banner.Title>Couldn&apos;t load today</Banner.Title>
                <Banner.Description>
                  {(error as Error).message ?? "Something went wrong."}
                </Banner.Description>
                <Banner.Action>
                  <Button intent="secondary" size="sm" onPress={handleRefresh}>
                    Try again
                  </Button>
                </Banner.Action>
              </Banner>
            ) : null}

            {/* ---- Level progress (gamification) ---- */}
            {lightQuery.data ? (
              <Card>
                <Card.Body>
                  <LevelProgress userLight={lightQuery.data} />
                </Card.Body>
              </Card>
            ) : null}

            {/* ---- Activity rings + legend ---- */}
            <Card>
              <Card.Body items="center" gap="$4" py="$5">
                {isLoading && !habitsQuery.data ? (
                  <View height={196} items="center" justify="center">
                    <Spinner size="large" />
                  </View>
                ) : (
                  <>
                    <ActivityRings size={196} rings={rings}>
                      <YStack items="center" gap="$0.5">
                        <Text fontSize="$8" fontWeight="700" color="$color">
                          {habitStats.doneToday + todoStats.done}
                        </Text>
                        <Text fontSize="$1" color="$mutedForeground">
                          done today
                        </Text>
                      </YStack>
                    </ActivityRings>
                    <XStack gap="$5" flexWrap="wrap" justify="center">
                      {rings.map((r) => (
                        <YStack key={r.label} items="center" gap="$1" minW={72}>
                          <XStack items="center" gap="$1.5">
                            <View
                              width={8}
                              height={8}
                              rounded={9999}
                              style={{ backgroundColor: r.color }}
                            />
                            <Text fontSize="$1" color="$mutedForeground">
                              {r.label}
                            </Text>
                          </XStack>
                          <Text fontSize="$2" fontWeight="600" color="$color">
                            {r.value}/{r.max}
                          </Text>
                        </YStack>
                      ))}
                    </XStack>
                    {habitStats.bestStreak > 0 ? (
                      <>
                        <Separator />
                        <XStack items="center" gap="$2">
                          <Text fontSize="$1" color="$mutedForeground">
                            Best habit streak
                          </Text>
                          <StreakBadge count={habitStats.bestStreak} />
                        </XStack>
                      </>
                    ) : null}
                  </>
                )}
              </Card.Body>
            </Card>

            {/* ---- Habit summary (features) ---- */}
            <HabitSummary
              habits={habitsQuery.data}
              habitProgress={habitProgressMap}
              isLoading={habitsQuery.isLoading}
              onViewAll={() => router.push("/habits")}
            />

            {/* ---- Today's todos (features) ---- */}
            <TodayTodos
              todos={todosQuery.data ?? []}
              isLoading={todosQuery.isLoading}
              total={todoStats.total}
              percentage={
                todoStats.total > 0
                  ? Math.round((todoStats.done / todoStats.total) * 100)
                  : 0
              }
              onToggleTodo={handleToggleTodo}
              onViewAll={() => router.push("/todos")}
            />

            {/* ---- Recent journals (features) ---- */}
            <RecentJournals
              journals={journalsQuery.data ?? []}
              isLoading={journalsQuery.isLoading}
              isLocked={journalLocked}
              onViewAll={() => router.push("/journal")}
              // Detail later — for now both press + view-all land on the
              // journal tab where the unlock + entry detail live.
              onJournalPress={() => router.push("/journal")}
            />
          </YStack>
        </PullToRefresh>
      </SafeAreaView>
    </YStack>
  );
}
