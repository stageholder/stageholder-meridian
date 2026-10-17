// apps/mobile/lib/api/dashboard-cache.ts
//
// THE write edges into the /dashboard/today aggregate cache.
//
// WHY THIS FILE EXISTS: the Today screen used to compose the shared
// `useTodos()` / `useHabits()` / `useJournals()` caches, so ANY mutation
// anywhere propagated to it for free. Collapsing those into one
// `/dashboard/today` aggregate (hooks/dashboard.ts) deleted that property —
// the aggregate is its own cache entry with no relationship to the per-resource
// keys, so without explicit edges it goes stale and STAYS stale:
//   - Today is a TAB ROOT, so it never unmounts → `refetchOnMount` never fires.
//   - `refetchOnWindowFocus` is false on RN (see query-client.ts).
//   - An active query that merely goes stale is not refetched on its own.
// Net effect without this module: add a todo on the Todos tab and the Today
// widget never shows it; tap a todo checkbox IN the Today widget and nothing
// happens. Only pull-to-refresh / reconnect / app restart recovered.
//
// CONTRACT (mirrors the project's optimistic-mutation contract):
//   - HOT taps (todo toggle/delete, habit check-in) PATCH the payload so the
//     widget flips on the tap frame — no round-trip.
//   - Everything that changes the SHAPE of the aggregate (create/delete a
//     habit, archive, journal create/delete) INVALIDATES, which costs exactly
//     ONE request — the whole point of the aggregate.
//   - Journal autosave PATCHES rather than invalidates: it fires continuously
//     while typing, and invalidating per keystroke-batch would refetch the
//     entire aggregate over and over.

import type { QueryClient } from "@tanstack/react-query";
import type {
  Habit,
  HabitEntry,
  Journal,
  Todo,
  UserLight,
} from "@repo/core/types";

import { dashboardKeys } from "./keys";

/** The RAW `/dashboard/today` payload as cached (journals already decrypted by
 *  the queryFn — see hooks/dashboard.ts). The `select` shaping to a
 *  TodayViewModel happens downstream, so every patch here targets this shape. */
export interface DashboardTodayPayload {
  today: string;
  habits: Array<Habit & { currentStreak: number }>;
  todayEntries: HabitEntry[];
  todos: Todo[];
  journals: Journal[];
  light: UserLight;
}

/** Apply `mutate` to every cached day's payload. Returning the same reference
 *  (or undefined) leaves that entry untouched. */
function patchDashboard(
  qc: QueryClient,
  mutate: (prev: DashboardTodayPayload) => DashboardTodayPayload | undefined,
) {
  qc.setQueriesData<DashboardTodayPayload>(
    { queryKey: dashboardKeys.todayAll() },
    (prev) => {
      if (!prev || typeof prev !== "object" || !Array.isArray(prev.todos)) {
        return prev;
      }
      return mutate(prev) ?? prev;
    },
  );
}

/** Refetch the aggregate (ONE request). Use for shape changes that aren't worth
 *  hand-patching — habit create/delete/archive, journal create/delete. */
export function invalidateDashboardToday(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: dashboardKeys.todayAll() });
}

// Server-derived numbers no client patch can compute: Light total/tier,
// perfect-day + ring streaks (lightKeys), and the per-habit `currentStreak`
// inside the aggregate. Hot taps patch the visible row instantly; these
// settle ONCE, ~1s after the last write of a burst, so five quick check-ins
// cost two refetches instead of ten. `["light"]` is lightKeys.all (kept
// literal to avoid a hooks → cache import cycle).
const SETTLE_DELAY_MS = 1000;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let settleDashboard = false;

export function settleDerivedAggregates(
  qc: QueryClient,
  opts: { dashboard?: boolean } = {},
) {
  if (opts.dashboard !== false) settleDashboard = true;
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    settleTimer = null;
    void qc.invalidateQueries({ queryKey: ["light"] });
    if (settleDashboard) invalidateDashboardToday(qc);
    settleDashboard = false;
  }, SETTLE_DELAY_MS);
}

// Generic trailing-edge invalidation for write-heavy paths (journal autosave
// fires every ~1s while typing). Each distinct key settles once, `ms` after
// its last call.
const debouncedTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function invalidateDebounced(
  qc: QueryClient,
  queryKey: readonly unknown[],
  ms = 3000,
) {
  const id = JSON.stringify(queryKey);
  const prev = debouncedTimers.get(id);
  if (prev) clearTimeout(prev);
  debouncedTimers.set(
    id,
    setTimeout(() => {
      debouncedTimers.delete(id);
      void qc.invalidateQueries({ queryKey });
    }, ms),
  );
}

/** Patch today's entry for one habit so the Today habit rows + habit ring flip
 *  instantly. A past-day check-in (day !== the cached `today`) is a no-op —
 *  that surface isn't showing it. */
export function patchDashboardEntry(
  qc: QueryClient,
  habitId: string,
  day: string,
  make: (existing: HabitEntry | undefined) => HabitEntry,
) {
  patchDashboard(qc, (prev) => {
    if (prev.today !== day || !Array.isArray(prev.todayEntries)) return prev;
    const matches = (e: HabitEntry) =>
      e.habitId === habitId && e.date?.slice(0, 10) === day;
    const existing = prev.todayEntries.find(matches);
    const next = make(existing);
    return {
      ...prev,
      todayEntries: existing
        ? prev.todayEntries.map((e) => (matches(e) ? next : e))
        : [...prev.todayEntries, next],
    };
  });
}

/** Remap the aggregate's habit rows — used by drag-reorder, which must keep the
 *  Today widget's row order in step with the Habits screen without a refetch.
 *  `apply` receives (and must return) rows that still carry `currentStreak`. */
export function patchDashboardHabits(
  qc: QueryClient,
  apply: (
    habits: DashboardTodayPayload["habits"],
  ) => DashboardTodayPayload["habits"],
) {
  patchDashboard(qc, (prev) =>
    Array.isArray(prev.habits) ? { ...prev, habits: apply(prev.habits) } : prev,
  );
}

/** Patch one todo in the aggregate (toggle / edit). No-op if it isn't there. */
export function patchDashboardTodo(
  qc: QueryClient,
  todoId: string,
  apply: (t: Todo) => Todo,
) {
  patchDashboard(qc, (prev) => {
    if (!prev.todos.some((t) => t.id === todoId)) return prev;
    return {
      ...prev,
      todos: prev.todos.map((t) => (t.id === todoId ? apply(t) : t)),
    };
  });
}

/** Drop a todo from the aggregate (swipe-delete). */
export function removeDashboardTodo(qc: QueryClient, todoId: string) {
  patchDashboard(qc, (prev) => {
    if (!prev.todos.some((t) => t.id === todoId)) return prev;
    return { ...prev, todos: prev.todos.filter((t) => t.id !== todoId) };
  });
}

/** Insert-or-replace a todo the server just returned (create / settle). Keeps
 *  the Today widget correct without a refetch when a new todo is dated today. */
export function writeDashboardTodo(qc: QueryClient, server: Todo) {
  patchDashboard(qc, (prev) => ({
    ...prev,
    todos: prev.todos.some((t) => t.id === server.id)
      ? prev.todos.map((t) => (t.id === server.id ? server : t))
      : [...prev.todos, server],
  }));
}

/** Replace a journal in the aggregate with the (already DECRYPTED) server copy.
 *  Drives the journal ring's word count. Only today's journals are carried in
 *  the payload, so an edit to an older entry is a no-op here. */
export function writeDashboardJournal(qc: QueryClient, server: Journal) {
  patchDashboard(qc, (prev) => {
    if (!Array.isArray(prev.journals)) return prev;
    if (!prev.journals.some((j) => j.id === server.id)) return prev;
    return {
      ...prev,
      journals: prev.journals.map((j) => (j.id === server.id ? server : j)),
    };
  });
}
