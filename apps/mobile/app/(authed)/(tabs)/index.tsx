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
  AnimatePresence,
  Banner,
  Button,
  Card,
  Dashboard,
  H2,
  IconButton,
  Paragraph,
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
import {
  JournalGrowthChart,
  LightEarnedChart,
  WeeklyActivityChart,
  WritingHeatmapChart,
} from "@repo/features/charts";
import { LevelProgress, LevelUpCelebration } from "@repo/features/light";
import type { Todo } from "@repo/core/types";
import type { UserLight } from "@repo/core/types/light";
import { CalendarDays, Search } from "@tamagui/lucide-icons-2";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useRouter } from "expo-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenScroll } from "@/components/screen-scroll";
import { CommandPalette } from "@/components/command-palette";
import { TrialPill } from "@/components/trial-pill";

import {
  journalKeys,
  useDeleteTodo,
  useToggleTodo,
  useUserLight,
} from "@/lib/api";
import { useDashboardToday } from "@/lib/api/hooks/dashboard";
import { HabitCheckInRow } from "@/components/habit-check-in-row";
import { EditTodoDialog } from "@/components/edit-todo-dialog";
import { useDayActivityCounts } from "@/lib/api/hooks/calendar";
import { IGNITION } from "@/lib/ignition-palette";
import { useLevelUp } from "@/lib/use-level-up";
import { useWarmTabs } from "@/lib/hooks/use-warm-tabs";
import { useLocalDayKey } from "@/lib/hooks/use-local-day";
import { useJournalGrowth } from "@/lib/use-journal-growth";
import { useWritingHeatmap } from "@/lib/use-writing-heatmap";
import { useLightTrend } from "@/lib/use-light-trend";
import { useWeeklyActivity } from "@/lib/use-weekly-activity";

// Fallback targets used until userLight resolves on first load. The real values
// live on /light/me and are tuned on the web app (PATCH /light/targets).
const DEFAULT_WORD_TARGET = 200;

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

// Sibling tabs warmed in the background from the landing screen so the FIRST
// tap on each is an instant native flip, not a lazy mount-on-tap (the "slow
// first click, fast after" behavior). Module constant → stable effect dep.
// Settings is light + rarely the first destination, so it mounts on demand.
const WARM_TABS = ["todos", "habits", "journal"] as const;
// Start well after Today's own first data + charts have committed, and space
// the mounts out: each warm mount is a long JS task, and stacking them in the
// first ~2s made any early tap/scroll wait behind them.
const WARM_START_MS = 2500;
const WARM_STEP_MS = 1500;

export default function TodayScreen() {
  const { user } = useUser();
  const router = useRouter();
  // Reactive day key (NOT a render-time snapshot) — this screen is a tab root
  // that never unmounts, so a snapshot would keep the whole dashboard on the
  // launch day after midnight. Same source `useDashboardToday` keys on, so the
  // rows' `activeDate` and the aggregate can never disagree. See use-local-day.
  const today = useLocalDayKey();
  // Pre-mount the other tabs shortly after Today paints (staggered, in the
  // background) so switching to them is instant — see use-warm-tabs.
  useWarmTabs(WARM_TABS, WARM_START_MS, WARM_STEP_MS);

  // ---- Queries ----
  // ONE request for the whole Today aggregate (rings + KPI display numbers +
  // habit/todo widget lists + journal words), shaped by the shared selector.
  // Replaces the old per-resource fan-out (useTodos/useHabits/useJournals +
  // the per-habit entries useQueries in useTodayHabitProgress) so arriving
  // data hits a single cache entry. `viewModel` is committed through
  // `useDeferredValue` below so a fresh payload yields to interaction (taps).
  const dash = useDashboardToday();
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

  // Commit the shaped view-model through useDeferredValue: when a fresh
  // /dashboard/today payload arrives, React can keep the current UI (and the
  // in-flight tap) responsive and re-render the widgets on a later, lower-
  // priority pass instead of blocking the frame. All Today data reads off `vm`.
  const vm = useDeferredValue(dash.viewModel);
  const rings = vm?.rings ?? [];
  const habitStats = vm?.habitStats ?? {
    doneToday: 0,
    totalScheduledToday: 0,
    bestStreak: 0,
  };
  const scheduledTodayHabits = vm?.scheduledTodayHabits ?? [];
  const todayTodoList = vm?.todayTodos ?? [];
  const journalWords = vm?.journalWordsToday ?? 0;
  // The todo ring's value IS the done-today todo count (the selector sets
  // ring.todo.value = doneTodos). Sourcing the KPI todo tile's numerator from
  // here keeps it in lockstep with the ring — no separate re-derivation.
  const todoRing = rings.find((r) => r.key === "todo");
  const doneTodos = todoRing?.value ?? 0;
  const todoRingMax = todoRing?.max ?? 0;

  const isLoading = dash.isLoading;
  const error = dash.error;

  // ---- Refresh ----
  const [refreshing, setRefreshing] = useState(false);
  // Command palette (PWA ⌘K parity) — opened from the header Search button.
  const [paletteOpen, setPaletteOpen] = useState(false);

  // PERF: gate for the below-the-fold trend charts — the four SVG chart
  // trees mount one painted frame + 300ms after the screen, so they never
  // compete with the launch/navigation frames. NOT InteractionManager —
  // verified on-simulator that runAfterInteractions can hang for seconds in
  // this app (open interaction handles), which stalled these gates.
  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      timer = setTimeout(() => setChartsReady(true), 300);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, []);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        dash.refetch(),
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

  // Daily journal-words target — feeds the KPI "Journal words" tile's
  // denominator. (The rings' own maxes are baked in by the selector, which
  // reads the same target off `light`.)
  const journalTarget =
    lightQuery.data?.journalTargetDailyWords ?? DEFAULT_WORD_TARGET;

  // The rings' value/max come straight from the selector (order journal→habit→
  // todo, outer→inner — the flame cross-section). The kit ActivityRings can't
  // resolve theme tokens on RN, so we paint the selector's value/max data onto
  // the SAME colored shape it received before, using the resolved IGNITION hex.
  // Memoized on the view-model rings identity so unrelated screen re-renders
  // (opening the command palette / a widget edit sheet) don't hand the animated
  // SVG a fresh array and make it re-reconcile — only real value moves change it.
  const ringData = useMemo(
    () =>
      rings.map((r) => ({
        value: r.value,
        // Drawing needs max >= 1; the LEGEND shows the real denominator (with
        // zero habits scheduled it read "Habits 0/1" next to a "0 / 0" tile).
        max: r.max,
        legendMax: r.key === "habit" ? habitStats.totalScheduledToday : r.max,
        color: IGNITION[r.key].base,
        trackColor: IGNITION[r.key].track,
        label: IGNITION[r.key].label,
      })),
    [rings, habitStats.totalScheduledToday],
  );

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
        // Same numerator AND denominator as the todo ring (done today /
        // max(done + still-open, daily goal)) so tile and ring never disagree.
        display: `${doneTodos} / ${todoRingMax}`,
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
    doneTodos,
    todoRingMax,
    habitStats,
    journalWords,
    journalTarget,
    todayCounts.counts,
    yesterdayCounts.counts,
  ]);

  // NOTE: `scheduledTodayHabits` (the widget's check-in rows) and
  // `todayTodoList` (the todos widget) now come straight off the view-model
  // (derived above) — the selector applies the exact same schedule/open
  // predicates and sort the old local memos did. Each HabitCheckInRow still
  // self-fetches its own day entry (a later unit passes entries down).

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
        <ScreenScroll refreshing={refreshing} onRefresh={handleRefresh}>
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
                <H2 color="$color" testID="today-greeting">
                  {greeting()}
                  {user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
                </H2>
              </YStack>
              <XStack items="center" gap="$2">
                {/* Trial countdown — renders only while `trialing` (the PWA
                    keeps this in the app-shell header; Today's header is the
                    mobile equivalent chrome). Taps to /upgrade. */}
                <TrialPill />
                {/* Command palette — the PWA's ⌘K, opened from a button on
                    touch (the kit adapts it to a bottom Sheet on phones). */}
                <IconButton
                  variant="ghost"
                  size="md"
                  hitSlop={6}
                  aria-label="Search"
                  onPress={() => setPaletteOpen(true)}
                >
                  <Search size={20} />
                </IconButton>
                {/* Month calendar (rings-per-day + day agenda) — the PWA's
                    /calendar, hidden-route on mobile. */}
                <IconButton
                  variant="ghost"
                  size="md"
                  hitSlop={6}
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
                    {isLoading && !vm ? (
                      <View height={196} items="center" justify="center">
                        <Spinner size="large" />
                      </View>
                    ) : (
                      <>
                        {/* Hollow center (PWA parity) — the legend below
                            carries the numbers; no glyph in the middle. */}
                        <ActivityRings size={196} rings={ringData} />
                        <XStack gap="$5" flexWrap="wrap" justify="center">
                          {ringData.map((r) => (
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
                                {r.value}/{r.legendMax}
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
                {isLoading && !vm ? (
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
                        // The view-model row already carries today's entry from
                        // the /dashboard/today aggregate — pass it so the row
                        // skips its own per-habit fetch (kills the widget's
                        // per-row fan-out). Optimistic writes patch this cache,
                        // so taps still flip instantly here.
                        entries={habit.todayEntry ? [habit.todayEntry] : []}
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
                {isLoading && !vm ? (
                  <TodayWidgetSkeleton />
                ) : todayTodoList.length === 0 ? (
                  <TodayWidgetEmpty text="Nothing due today — nice work." />
                ) : (
                  <YStack gap="$2">
                    {/* AnimatePresence plays the exit when a checked todo
                        leaves the widget (same as the PWA dashboard). */}
                    <AnimatePresence>
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
                    </AnimatePresence>
                  </YStack>
                )}
              </Dashboard.Widget>

              {/* ---- Trend charts (PWA dashboard parity: journal pair, then
                   the weekly-activity + light-growth pair). Shared views over
                   the kit's cross-platform charts; color is a theme token
                   because the views' CSS-var default can't resolve on RN.

                   PERF: chart CONTENT gates on `chartsReady` — the widget
                   frames mount with the screen, but the four SVG chart trees
                   (all below the fold) mount only after the tab-switch /
                   first-mount interactions settle, so they never compete with
                   the navigation frame. Fixed-height placeholders keep the
                   scroll extent stable. ---- */}
              <Dashboard.Widget colSpan={12} title="Journal Growth">
                {chartsReady ? (
                  <JournalGrowthChart
                    data={journalGrowth.data}
                    isLoading={journalGrowth.isLoading}
                    color="#facc15"
                  />
                ) : (
                  <View height={200} />
                )}
              </Dashboard.Widget>
              {/* Writing activity — GitHub-style word-count heatmap in the
                  journal identity colour. Colour is baked into the view (no
                  CSS-var resolution needed), so no `color` prop here. */}
              <Dashboard.Widget colSpan={12} title="Writing Activity">
                {chartsReady ? (
                  <WritingHeatmapChart
                    data={writingHeatmap.data}
                    isLoading={writingHeatmap.isLoading}
                  />
                ) : (
                  <View height={200} />
                )}
              </Dashboard.Widget>
              {/* Activity pair: weekly activity (stacked todo/habit/journal in
                  identity colours) then light growth (gapped bars). */}
              <Dashboard.Widget colSpan={12} title="Weekly Activity">
                {chartsReady ? (
                  <WeeklyActivityChart
                    data={weeklyActivity.data}
                    isLoading={weeklyActivity.isLoading}
                  />
                ) : (
                  <View height={200} />
                )}
              </Dashboard.Widget>
              <Dashboard.Widget colSpan={12} title="Light Growth">
                {chartsReady ? (
                  <LightEarnedChart
                    data={lightTrend}
                    isLoading={lightTrendLoading}
                  />
                ) : (
                  <View height={200} />
                )}
              </Dashboard.Widget>
            </Dashboard>
          </YStack>
        </ScreenScroll>
      </SafeAreaView>

      {/* Tap a todo in the widget → shared edit sheet (same as /todos). */}
      <EditTodoDialog
        open={editTodoOpen}
        onOpenChange={setEditTodoOpen}
        todo={editingTodo}
      />

      {/* Command palette (⌘K parity) — kit CommandMenu, bottom Sheet on
          phones; hosts its own New Todo / New Habit create sheets. */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

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
