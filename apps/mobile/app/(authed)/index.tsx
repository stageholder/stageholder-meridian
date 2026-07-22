// apps/mobile/app/(authed)/index.tsx
//
// Today — the dashboard. Single-column mobile counterpart of the PWA's bento
// grid (apps/pwa/src/routes/_app/index.tsx): greeting + date → level progress
// → activity rings → KPI row → habit summary → today's todos → trend charts
// (weekly activity · journal growth · light growth) → recent journals. Same
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
  Dashboard,
  H2,
  IconButton,
  Paragraph,
  PullToRefresh,
  Separator,
  Spinner,
  StreakBadge,
  Text,
  View,
  XStack,
  YStack,
  usePressScale,
} from "@stageholder/ui";
import {
  DashboardStats,
  type DashboardStatItem,
} from "@repo/features/dashboard";
import { TodoItem } from "@repo/features/todos";
import { scheduledHabitsForDate } from "@repo/core/habits/entry-resolution";
import {
  JournalGrowthChart,
  LightEarnedChart,
  WeeklyActivityChart,
  WritingHeatmapChart,
} from "@repo/features/charts";
import { LevelProgress, LevelUpCelebration } from "@repo/features/light";
import type { Todo } from "@repo/core/types";
import type { UserLight } from "@repo/core/types/light";
import { CalendarDays } from "@tamagui/lucide-icons-2";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { TrialPill } from "@/components/trial-pill";

import {
  journalKeys,
  useDeleteTodo,
  useHabits,
  useJournals,
  useTodayHabitProgress,
  useToggleTodo,
  useTodos,
  useUserLight,
} from "@/lib/api";
import { HabitCheckInRow } from "@/components/habit-check-in-row";
import { EditTodoDialog } from "@/components/edit-todo-dialog";
import { useDayActivityCounts } from "@/lib/api/hooks/calendar";
import { IGNITION } from "@/lib/ignition-palette";
import { useLevelUp } from "@/lib/use-level-up";
import { localDateKey } from "@/lib/streak";
import { useJournalGrowth } from "@/lib/use-journal-growth";
import { useWritingHeatmap } from "@/lib/use-writing-heatmap";
import { useLightTrend } from "@/lib/use-light-trend";
import { useWeeklyActivity } from "@/lib/use-weekly-activity";

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

/** Day-over-day trend for a KPI — up/down/flat with a signed count (PWA
 *  `useDashboardStats.delta` parity). */
function dayDelta(
  todayValue: number,
  yesterdayValue: number,
): DashboardStatItem["delta"] {
  const diff = todayValue - yesterdayValue;
  if (diff > 0) return { direction: "up", label: `↑ ${diff}` };
  if (diff < 0) return { direction: "down", label: `↓ ${Math.abs(diff)}` };
  return { direction: "flat", label: "—" };
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
  // 14-day cumulative Light trend — the last two days feed the KPI row's
  // "Light today" delta, and the full series feeds the Light Growth chart.
  // Shares the cached useLightStats query with /journey — no extra network.
  const { data: lightTrend, isLoading: lightTrendLoading } = useLightTrend();
  // Trend charts (PWA dashboard parity) — weekly activity reads the same
  // ["calendar", month] caches the calendar screen uses; journal growth reads
  // the 30-day /journals/stats window.
  const weeklyActivity = useWeeklyActivity();
  const journalGrowth = useJournalGrowth();
  const writingHeatmap = useWritingHeatmap();
  // Today-vs-yesterday counts for the KPI deltas — BOTH days come from the
  // calendar month cache so the comparison pair is internally consistent
  // (PWA useDashboardStats parity). Display values stay on the fresher live
  // queries; the delta is a trend hint, not the headline number.
  const todayCounts = useDayActivityCounts(today);
  const yesterdayCounts = useDayActivityCounts(
    format(subDays(new Date(), 1), "yyyy-MM-dd"),
  );

  // Level-up celebration — fires when the user crosses a tier WHILE on Today
  // (e.g. completing the habit that tips them over). Previously only wired on
  // /journey, so a level-up earned from the dashboard was silently dropped
  // unless the user happened to be on Journey. Shares the ref-compare hook with
  // Journey (both mount it; whichever is visible when the tier flips shows it).
  const { levelUpTier, dismiss: dismissLevelUp } = useLevelUp(lightQuery.data);

  const toggleTodo = useToggleTodo();
  const qc = useQueryClient();

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
        // Trend-chart sources — invalidate (refetches active queries) rather
        // than holding refs to the per-month calendar queries.
        qc.invalidateQueries({ queryKey: ["calendar"] }),
        qc.invalidateQueries({ queryKey: journalKeys.stats() }),
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

  // KPI tiles for the shared `DashboardStats` row (kit `Stat`). Light gets an
  // animated single-number value; every tile carries a day-over-day delta
  // (PWA parity) — Light's from the trend hook, the rest from the calendar
  // month cache's today/yesterday counts.
  const stats = useMemo<DashboardStatItem[]>(() => {
    const lightToday = lightTrend.at(-1)?.earned ?? 0;
    const lightYesterday = lightTrend.at(-2)?.earned ?? 0;
    const t = todayCounts.counts;
    const y = yesterdayCounts.counts;

    return [
      {
        key: "light",
        label: "Light today",
        value: lightToday,
        delta: dayDelta(lightToday, lightYesterday),
      },
      {
        key: "streak",
        label: "Day streak",
        value: lightQuery.data?.perfectDayStreak ?? 0,
      },
      {
        key: "todos",
        label: "Todos",
        display: `${todoStats.done} / ${todoStats.total}`,
        delta: dayDelta(t.todoDone, y.todoDone),
      },
      {
        key: "habits",
        label: "Habits",
        display: `${habitStats.doneToday} / ${habitStats.totalScheduledToday}`,
        delta: dayDelta(t.habitDone, y.habitDone),
      },
      {
        key: "journal",
        label: "Journal words",
        display: `${journalWords} / ${journalTarget}`,
        delta: dayDelta(t.journalWords, y.journalWords),
      },
    ];
  }, [
    lightTrend,
    lightQuery.data,
    todoStats,
    habitStats,
    journalWords,
    journalTarget,
    todayCounts.counts,
    yesterdayCounts.counts,
  ]);

  // The habits scheduled today — the widget renders the first few as REAL
  // interactive check-in rows (parity with the PWA dashboard, which reuses the
  // real HabitListItem). Each HabitCheckInRow self-fetches its day entry, so no
  // per-habit progress map is needed here anymore.
  const scheduledTodayHabits = useMemo(
    () => scheduledHabitsForDate(habitsQuery.data, today),
    [habitsQuery.data, today],
  );

  // Today's open todos (do/due today-or-overdue), earliest-date first, so the
  // widget mirrors the /todos Today view. Rendered as the real TodoItem.
  const todayTodoList = useMemo(() => {
    const todos = todosQuery.data ?? [];
    const open = todos.filter((t) => {
      if (t.status === "done") return false;
      const due = t.dueDate?.slice(0, 10);
      const doD = t.doDate?.slice(0, 10);
      return (
        (due !== undefined && due <= today) ||
        (doD !== undefined && doD <= today)
      );
    });
    const dateKey = (t: Todo) => {
      const ds = [t.doDate, t.dueDate]
        .filter((d): d is string => !!d)
        .map((d) => d.slice(0, 10));
      return ds.length ? ds.sort()[0] : today;
    };
    return open.sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
  }, [todosQuery.data, today]);

  function handleToggleTodo(todo: Todo) {
    toggleTodo.mutate({ id: todo.id, status: todo.status });
  }
  const deleteTodo = useDeleteTodo();
  // Tap a todo → open the shared edit sheet (same as the /todos screen). Split
  // open flag from content so the sheet keeps its values through the exit anim.
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editTodoOpen, setEditTodoOpen] = useState(false);
  function openTodoEdit(todo: Todo) {
    setEditingTodo(todo);
    setEditTodoOpen(true);
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
            {/* ---- Header: date + greeting · calendar entry ---- */}
            <XStack items="flex-start" justify="space-between" gap="$3">
              <YStack gap="$1" flex={1} minW={0}>
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
              <XStack items="center" gap="$2">
                {/* Trial countdown — renders only while `trialing` (the PWA
                    keeps this in the app-shell header; Today's header is the
                    mobile equivalent chrome). Taps to /upgrade. */}
                <TrialPill />
                {/* Month calendar (rings-per-day + day agenda) — the PWA's
                    /calendar, hidden-route on mobile. */}
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Open calendar"
                  onPress={() => router.push("/calendar")}
                >
                  <CalendarDays size={20} />
                </IconButton>
              </XStack>
            </XStack>

            {/* ---- Error banner ---- */}
            {error ? (
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Couldn&apos;t load today</Banner.Title>
                  <Banner.Description>
                    {(error as Error).message ?? "Something went wrong."}
                  </Banner.Description>
                  <Banner.Action self="flex-end" mt="$2">
                    <Button
                      intent="secondary"
                      size="sm"
                      onPress={handleRefresh}
                    >
                      Try again
                    </Button>
                  </Banner.Action>
                </Banner.Body>
              </Banner>
            ) : null}

            {/* ---- Dashboard grid: motivation-first stack. Kit `Dashboard`
                 renders a 12-col grid on wide screens but STACKS to a single
                 column on native, so on mobile every widget is a full-width
                 card. The hero widgets (level + rings) stay chromeless
                 (`bordered={false} flush`) so their existing pressable
                 `Card`/rings visual shows through unchanged; the section
                 widgets (habits/todos/journals) take the widget's own card
                 chrome + title + "View all" action. ---- */}
            <Dashboard columns={12} gap="$4">
              {/* ---- Level progress (gamification) — taps through to the
                   Journey screen (tier path, streaks, Light feed). Hosted in a
                   flush chromeless widget so the pressable `LevelProgressCard`
                   keeps its own card + press-scale. ---- */}
              {lightQuery.data ? (
                <Dashboard.Widget
                  colSpan={12}
                  hideHeader
                  bordered={false}
                  flush
                >
                  <LevelProgressCard
                    userLight={lightQuery.data}
                    onPress={() => router.push("/journey")}
                  />
                </Dashboard.Widget>
              ) : null}

              {/* ---- Activity rings + legend ---- */}
              <Dashboard.Widget colSpan={12} hideHeader bordered={false} flush>
                <Card>
                  <Card.Body items="center" gap="$4" py="$5">
                    {isLoading && !habitsQuery.data ? (
                      <View height={196} items="center" justify="center">
                        <Spinner size="large" />
                      </View>
                    ) : (
                      <>
                        <ActivityRings size={196} rings={rings}>
                          {/* The flame at the heart of the ignition rings —
                              the legend below carries the numbers, so the
                              center stays a pure identity mark. */}
                          <Text fontSize={40} lineHeight={48}>
                            🔥
                          </Text>
                        </ActivityRings>
                        <XStack gap="$5" flexWrap="wrap" justify="center">
                          {rings.map((r) => (
                            <YStack
                              key={r.label}
                              items="center"
                              gap="$1"
                              minW={72}
                            >
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
                              <Text
                                fontSize="$2"
                                fontWeight="600"
                                color="$color"
                              >
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
              </Dashboard.Widget>

              {/* ---- KPI row (shared DashboardStats) — chromeless flush cell;
                   the `Stat` tiles carry their own hairline card borders. ---- */}
              <Dashboard.Widget colSpan={12} hideHeader bordered={false} flush>
                <DashboardStats stats={stats} />
              </Dashboard.Widget>

              {/* ---- Habits Today — REAL interactive check-in rows (parity
                   with the PWA dashboard). Check in / skip / fail right here;
                   "View all" opens the full habits screen. ---- */}
              <Dashboard.Widget
                colSpan={12}
                title="Habits Today"
                actions={<ViewAll onPress={() => router.push("/habits")} />}
              >
                {habitsQuery.isLoading && !habitsQuery.data ? (
                  <TodayWidgetSkeleton />
                ) : scheduledTodayHabits.length === 0 ? (
                  <TodayWidgetEmpty text="No habits scheduled today." />
                ) : (
                  <YStack gap="$2">
                    {scheduledTodayHabits.slice(0, WIDGET_CAP).map((habit) => (
                      <HabitCheckInRow
                        key={habit.id}
                        habit={habit}
                        activeDate={today}
                        onOpenDetail={() => router.push(`/habits/${habit.id}`)}
                      />
                    ))}
                  </YStack>
                )}
              </Dashboard.Widget>

              {/* ---- Today's Todos — REAL TodoItem (compact): checkbox + burn,
                   tap to edit. Mirrors the PWA dashboard's compact TodoItem. -- */}
              <Dashboard.Widget
                colSpan={12}
                title="Today's Todos"
                actions={<ViewAll onPress={() => router.push("/todos")} />}
              >
                {todosQuery.isLoading && !todosQuery.data ? (
                  <TodayWidgetSkeleton />
                ) : todayTodoList.length === 0 ? (
                  <TodayWidgetEmpty text="Nothing due today — nice work." />
                ) : (
                  <YStack gap="$2">
                    {todayTodoList.slice(0, WIDGET_CAP).map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        compact
                        onToggle={() => handleToggleTodo(todo)}
                        onDelete={() => deleteTodo.mutate(todo.id)}
                        onOpenDetail={() => openTodoEdit(todo)}
                      />
                    ))}
                  </YStack>
                )}
              </Dashboard.Widget>

              {/* ---- Trend charts (PWA dashboard parity: journal pair, then
                   the weekly-activity + light-growth pair). Shared views over
                   the kit's cross-platform charts; color is a theme token
                   because the views' CSS-var default can't resolve on RN. ---- */}
              {/* Journal pair: growth trend then its word-count heatmap, both
                  in the journal identity colour (#facc15). */}
              <Dashboard.Widget colSpan={12} title="Journal Growth">
                <JournalGrowthChart
                  data={journalGrowth.data}
                  isLoading={journalGrowth.isLoading}
                  color="#facc15"
                />
              </Dashboard.Widget>
              {/* Writing activity — GitHub-style word-count heatmap in the
                  journal identity colour. Colour is baked into the view (no
                  CSS-var resolution needed), so no `color` prop here. */}
              <Dashboard.Widget colSpan={12} title="Writing Activity">
                <WritingHeatmapChart
                  data={writingHeatmap.data}
                  isLoading={writingHeatmap.isLoading}
                />
              </Dashboard.Widget>
              {/* Activity pair: weekly activity (stacked todo/habit/journal in
                  identity colours) then light growth (gapped bars). */}
              <Dashboard.Widget colSpan={12} title="Weekly Activity">
                <WeeklyActivityChart
                  data={weeklyActivity.data}
                  isLoading={weeklyActivity.isLoading}
                />
              </Dashboard.Widget>
              <Dashboard.Widget colSpan={12} title="Light Growth">
                <LightEarnedChart
                  data={lightTrend}
                  isLoading={lightTrendLoading}
                />
              </Dashboard.Widget>
            </Dashboard>
          </YStack>
        </PullToRefresh>
      </SafeAreaView>

      {/* Tap a todo in the widget → shared edit sheet (same as /todos). */}
      <EditTodoDialog
        open={editTodoOpen}
        onOpenChange={setEditTodoOpen}
        todo={editingTodo}
      />

      {/* Level-up overlay — rendered above the scroll frame so it covers the
          whole screen when a tier is crossed from Today. */}
      {levelUpTier ? (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismissLevelUp} />
      ) : null}
    </YStack>
  );
}

/** Max rows a Today widget shows before "View all". */
const WIDGET_CAP = 5;

/** Compact empty-state line for a Today widget body. */
function TodayWidgetEmpty({ text }: { text: string }) {
  return (
    <Text fontSize="$2" color="$mutedForeground" py="$2">
      {text}
    </Text>
  );
}

/** A couple of muted placeholder rows while a Today widget's data loads. */
function TodayWidgetSkeleton() {
  return (
    <YStack gap="$2">
      {[0, 1, 2].map((i) => (
        <View key={i} height={56} rounded="$4" bg="$muted" opacity={0.4} />
      ))}
    </YStack>
  );
}

/* ------------------------------ Widget actions ----------------------------- */

/**
 * The "View all" affordance in a `Dashboard.Widget`'s right-aligned `actions`
 * slot — a small primary-tinted pressable label. RN `Text` handles `onPress`
 * directly, so no wrapping Pressable is needed.
 */
function ViewAll({ onPress }: { onPress: () => void }) {
  return (
    <Text
      fontSize="$1"
      color="$primary"
      onPress={onPress}
      pressStyle={{ opacity: 0.6 }}
    >
      View all
    </Text>
  );
}

/* --------------------------- Level progress card --------------------------- */

/**
 * The dashboard's tappable gamification card — LevelProgress plus a "view
 * journey" affordance, navigating to the Journey screen. Own component so it
 * can hold a `usePressScale` (kit press-latch animation; hooks can't sit in
 * conditional JSX).
 */
function LevelProgressCard({
  userLight,
  onPress,
}: {
  userLight: UserLight;
  onPress: () => void;
}) {
  const { handlers, pressProps } = usePressScale({ onPress, haptic: "none" });
  return (
    <Card {...handlers} {...pressProps} transition="quick" role="button">
      <Card.Body gap="$2">
        <LevelProgress userLight={userLight} />
        <Text fontSize="$1" color="$mutedForeground" self="flex-end">
          View journey ›
        </Text>
      </Card.Body>
    </Card>
  );
}
