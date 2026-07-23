// apps/mobile/lib/api/hooks/habits.ts
//
// React Query hooks for /habits and /habits/:id/entries.
// Field names align with @repo/core/types — habit has `name` (not title),
// `targetCount` (not target), `frequency`, no inline checkIns. Per-day
// state lives in HabitEntry rows fetched via useHabitEntries.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import type { Habit, HabitEntry } from "@repo/core/types";

import { apiClient } from "../client";
import { habitKeys } from "../keys";

// ─────────────────────────────────────────────────────────────────────────
// DATA-LAYER CONTRACT (simplified 2026-07-23 — the old snapshot/rollback +
// surgical-cache-write machinery in optimistic.ts / calendar-cache.ts was
// offline-era ceremony; the smooth sibling apps run plain React Query):
//
//   • HOT taps (check-in / skip / fail / undo) get ONE optimistic
//     setQueriesData write so the control flips on the tap frame.
//   • Everything self-heals through STANDARD invalidation: onSettled
//     refetches this habit's entries + the ONE affected calendar month.
//     Errors need no bespoke rollback — the same refetch corrects the
//     cache (409 races included).
//   • Non-tap mutations (create / archive / reorder) are plain
//     mutate → invalidate.
// ─────────────────────────────────────────────────────────────────────────

/** Serializes entry writes so rapid repeat taps can't race into a duplicate
 *  POST (409) or a stale-id PATCH — without disabling the control. */
const ENTRY_SCOPE = { id: "habit-entry" };

/** The day key an entry write targets (server defaults omitted dates). */
function entryDay(date?: string): string {
  return date ?? new Date().toISOString().slice(0, 10);
}

/** Optimistically create-or-update the day's entry across every cached
 *  entries window (base + 90-day + detail windows share the key prefix). */
function upsertDayEntry(
  qc: QueryClient,
  habitId: string,
  day: string,
  make: (existing: HabitEntry | undefined) => HabitEntry,
) {
  qc.setQueriesData<HabitEntry[]>(
    { queryKey: habitKeys.entries(habitId) },
    (list) => {
      if (!Array.isArray(list)) return list;
      const existing = list.find((e) => e.date?.slice(0, 10) === day);
      const next = make(existing);
      return existing
        ? list.map((e) => (e.date?.slice(0, 10) === day ? next : e))
        : [...list, next];
    },
  );
}

/** Placeholder row for a day with no entry yet — replaced by the settle
 *  refetch moments later. */
function optimisticEntry(
  habitId: string,
  day: string,
  value: number,
  type: HabitEntry["type"],
  skipReason?: string,
): HabitEntry {
  return {
    id: `optimistic-${type}-${day}`,
    habitId,
    userSub: "",
    date: day,
    value,
    type,
    skipReason,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as HabitEntry;
}

/** Write the server's authoritative entry into every cached entries window,
 *  replacing the optimistic row (by day). CRITICAL: this swaps the
 *  `optimistic-…` id for the real id, which clears the day-actions
 *  `isPending` lock IMMEDIATELY — without it the control stays disabled until
 *  a refetch round-trip lands (the "can't check / locked between taps" bug,
 *  worst on multi-count habits). Standard RQ "update from mutation response". */
function writeServerEntry(
  qc: QueryClient,
  habitId: string,
  server: HabitEntry,
) {
  const day = server.date?.slice(0, 10);
  qc.setQueriesData<HabitEntry[]>(
    { queryKey: habitKeys.entries(habitId) },
    (list) => {
      if (!Array.isArray(list)) return list;
      const has = list.some((e) => e.date?.slice(0, 10) === day);
      return has
        ? list.map((e) => (e.date?.slice(0, 10) === day ? server : e))
        : [...list, server];
    },
  );
}

/** Refresh the ONE calendar month the day belongs to (the aggregation the
 *  entries cache can't update). Never the whole ["calendar"] prefix. */
function settleCalendarMonth(qc: QueryClient, day: string) {
  void qc.invalidateQueries({ queryKey: ["calendar", day.slice(0, 7)] });
}

/* ------------------------------ Reads -------------------------------- */

export function useHabits() {
  return useQuery({
    queryKey: habitKeys.list(),
    queryFn: async () => {
      // The grouped/sectioned habits UI renders the FULL active set client-side,
      // so request all of it (server MAX_LIMIT=500) rather than the default
      // first page of 20 — otherwise habits past #20 silently vanish from their
      // group. Archived habits are excluded server-side.
      const { data } = await apiClient.get<{ data: Habit[] } | Habit[]>(
        "/habits",
        { params: { limit: 500 } },
      );
      return Array.isArray(data) ? data : data.data;
    },
  });
}

export function useHabit(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? habitKeys.detail(id) : habitKeys.detail("disabled"),
    queryFn: async () => {
      const { data } = await apiClient.get<Habit>(`/habits/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useHabitEntries(
  habitId: string | null | undefined,
  /** Optional yyyy-MM-dd window — the server filters /habits/:id/entries by
   *  startDate/endDate (the PWA's detail page depends on this). Omitted →
   *  the server default window, exactly as before. */
  range?: { startDate?: string; endDate?: string },
) {
  const baseKey = habitId
    ? habitKeys.entries(habitId)
    : habitKeys.entries("disabled");
  return useQuery({
    // Range rides the key as an extra segment so windowed queries cache
    // separately while invalidateQueries(habitKeys.entries(id)) still
    // prefix-matches every window.
    queryKey: range ? ([...baseKey, range] as const) : baseKey,
    queryFn: async () => {
      const { data } = await apiClient.get<
        { data: HabitEntry[] } | HabitEntry[]
      >(`/habits/${habitId}/entries`, { params: range });
      return Array.isArray(data) ? data : data.data;
    },
    enabled: !!habitId,
  });
}

/**
 * THE canonical entries window — last 90 days through today, widened only
 * when `activeDate` falls outside it (deep calendar date-nav). 90 days covers
 * the streak walk + current-week quota math (PWA parity).
 *
 * PERF: every surface that needs a habit's entries (HabitCard, the compact
 * check-in row, the Today aggregate) MUST fetch through this one window so
 * they share a single cache entry + network request per habit. Before this,
 * the same habit's entries lived under THREE keys at once (unwindowed via
 * the Today useQueries, a 1-day window per check-in row, a 90-day window per
 * card) — ~3× the observers, ~3× the refetches, and a cold refetch-all every
 * time the card⇄list toggle switched key shapes.
 */
export function habitEntriesWindow(activeDate?: string): {
  startDate: string;
  endDate: string;
} {
  const today = format(new Date(), "yyyy-MM-dd");
  const d = activeDate ?? today;
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");
  return {
    startDate: d < ninetyDaysAgo ? d : ninetyDaysAgo,
    endDate: d > today ? d : today,
  };
}

/** `useHabitEntries` pinned to the canonical shared window. */
export function useSharedHabitEntries(
  habitId: string | null | undefined,
  activeDate?: string,
) {
  return useHabitEntries(habitId, habitEntriesWindow(activeDate));
}

/* ---------------------------- Mutations ------------------------------ */

export type CreateHabitInput = {
  name: string;
  description?: string;
  frequency?: Habit["frequency"];
  targetCount?: number;
  scheduledDays?: number[];
  unit?: string;
  color?: string;
  icon?: string;
  /** Group membership — null/omitted = Ungrouped. */
  groupId?: string | null;
};

export function useCreateHabit() {
  const qc = useQueryClient();
  // Plain create → refetch. No temp-row theater: the create sheet closes on
  // success and the list refetch lands in the same beat.
  return useMutation({
    mutationFn: async (input: CreateHabitInput) => {
      const { data } = await apiClient.post<Habit>("/habits", {
        frequency: "daily",
        targetCount: 1,
        ...input,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.lists() }),
  });
}

/**
 * Edit-only fields. Superset of `CreateHabitInput`: adds `weeklyTarget`
 * (times-per-week target) and lets `scheduledDays` be `null` to WIPE a
 * previously-set schedule — the form emits `undefined` for "no specific
 * days", so the edit host translates that to `null`. Mirrors the PWA's
 * useUpdateHabit data shape (apps/pwa/src/lib/api/habits.ts).
 */
export type UpdateHabitInput = Partial<
  Omit<CreateHabitInput, "scheduledDays">
> & {
  scheduledDays?: number[] | null;
  weeklyTarget?: number;
};

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateHabitInput;
    }) => {
      const { data } = await apiClient.patch<Habit>(`/habits/${id}`, patch);
      return data;
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
      if (vars) qc.invalidateQueries({ queryKey: habitKeys.detail(vars.id) });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/habits/${id}`);
      return id;
    },
    // Instant removal; the settle refetch restores it if the delete failed.
    onMutate: (id) => {
      qc.setQueriesData<Habit[]>({ queryKey: habitKeys.lists() }, (list) =>
        Array.isArray(list) ? list.filter((h) => h.id !== id) : list,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: habitKeys.lists() }),
  });
}

/* ------------------- Reorder / archive / archived list -------------------- */
// Group-grid parity with the PWA (apps/pwa/src/lib/api/habits.ts):
//   - reorder    — sparse {id, order, groupId?} update; including groupId moves
//                  the habit between groups in the same call (drag-between).
//   - archive    — soft-hides a habit from the default list, preserving history.
//   - unarchive  — restores it.
//   - archived   — the Archived view's own cache (server ?archivedOnly=true).

export function useReorderHabits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      items: { id: string; order: number; groupId?: string | null }[];
    }) => {
      await apiClient.post("/habits/reorder", data);
    },
    // Hold the dropped position instead of snapping back; a failed save
    // self-heals via the error refetch.
    onMutate: ({ items }) => {
      const patchById = new Map(items.map((i) => [i.id, i]));
      qc.setQueriesData<Habit[]>({ queryKey: habitKeys.lists() }, (list) =>
        Array.isArray(list)
          ? list.map((h) => {
              const p = patchById.get(h.id);
              if (!p) return h;
              return {
                ...h,
                order: p.order,
                ...(p.groupId !== undefined ? { groupId: p.groupId } : {}),
              } as Habit;
            })
          : list,
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: habitKeys.lists() }),
  });
}

export function useArchiveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Habit>(`/habits/${id}/archive`, {});
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitKeys.lists() });
      void qc.invalidateQueries({ queryKey: habitKeys.archived() });
    },
  });
}

export function useUnarchiveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Habit>(
        `/habits/${id}/unarchive`,
        {},
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitKeys.lists() });
      void qc.invalidateQueries({ queryKey: habitKeys.archived() });
    },
  });
}

export function useArchivedHabits(enabled = true) {
  return useQuery({
    queryKey: habitKeys.archived(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Habit[] } | Habit[]>(
        "/habits",
        { params: { archivedOnly: "true" } },
      );
      return Array.isArray(data) ? data : data.data;
    },
    // Lazy: only hit the network when the Archived view is actually active
    // (the caller passes whether that chip is selected).
    enabled,
  });
}

/* -------------------------- Check-in ------------------------- */

export type CheckInInput = {
  habitId: string;
  /** yyyy-mm-dd. Defaults to today on the server. */
  date?: string;
  /** Increment by this amount. Defaults to 1. */
  value?: number;
};

/**
 * Check in (create-or-update today's entry). Optimistic: bumps the entry
 * cache so HabitCard's "checked today" state flips instantly. The server
 * is the source of truth for streak math + value normalization.
 */
export function useCheckInHabit() {
  const qc = useQueryClient();
  return useMutation({
    scope: ENTRY_SCOPE,
    mutationFn: async (input: CheckInInput) => {
      const { data } = await apiClient.post<HabitEntry>(
        `/habits/${input.habitId}/entries`,
        { date: input.date, value: input.value ?? 1, type: "completion" },
      );
      return data;
    },
    // Instant checkbox: bump the day's entry in every cached window.
    onMutate: (input) => {
      const day = entryDay(input.date);
      const inc = input.value ?? 1;
      upsertDayEntry(qc, input.habitId, day, (e) =>
        e
          ? ({
              ...e,
              type: "completion",
              value: (e.value ?? 0) + inc,
            } as HabitEntry)
          : optimisticEntry(input.habitId, day, inc, "completion"),
      );
      return { day };
    },
    // Swap the optimistic row for the server entry (real id → clears the
    // isPending lock immediately, no refetch wait).
    onSuccess: (server, vars) => writeServerEntry(qc, vars.habitId, server),
    // A failed write self-heals by refetching entries.
    onError: (_e, vars) =>
      void qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) }),
    onSettled: (_data, _err, vars, ctx) =>
      settleCalendarMonth(qc, ctx?.day ?? entryDay(vars.date)),
  });
}

/** Mark a date as skipped (off-day, doesn't break streak). */
export function useSkipHabit() {
  const qc = useQueryClient();
  return useMutation({
    scope: ENTRY_SCOPE,
    mutationFn: async (input: {
      habitId: string;
      date?: string;
      reason?: string;
    }) => {
      const { data } = await apiClient.post<HabitEntry>(
        `/habits/${input.habitId}/entries`,
        { date: input.date, value: 0, type: "skip", skipReason: input.reason },
      );
      return data;
    },
    onMutate: (input) => {
      const day = entryDay(input.date);
      upsertDayEntry(qc, input.habitId, day, (e) =>
        e
          ? ({
              ...e,
              type: "skip",
              value: 0,
              skipReason: input.reason,
            } as HabitEntry)
          : optimisticEntry(input.habitId, day, 0, "skip", input.reason),
      );
      return { day };
    },
    onSuccess: (server, vars) => writeServerEntry(qc, vars.habitId, server),
    onError: (_e, vars) =>
      void qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) }),
    onSettled: (_data, _err, vars, ctx) =>
      settleCalendarMonth(qc, ctx?.day ?? entryDay(vars.date)),
  });
}

/**
 * Mark a date as failed — user explicitly admitting a miss. Breaks the
 * streak immediately. Distinct from skip (which preserves the streak) and
 * from leaving the day open (which doesn't break until day-rollover).
 */
export function useFailHabit() {
  const qc = useQueryClient();
  return useMutation({
    scope: ENTRY_SCOPE,
    mutationFn: async (input: { habitId: string; date?: string }) => {
      const { data } = await apiClient.post<HabitEntry>(
        `/habits/${input.habitId}/entries`,
        { date: input.date, value: 0, type: "fail" },
      );
      return data;
    },
    onMutate: (input) => {
      const day = entryDay(input.date);
      upsertDayEntry(qc, input.habitId, day, (e) =>
        e
          ? ({ ...e, type: "fail", value: 0 } as HabitEntry)
          : optimisticEntry(input.habitId, day, 0, "fail"),
      );
      return { day };
    },
    onSuccess: (server, vars) => writeServerEntry(qc, vars.habitId, server),
    onError: (_e, vars) =>
      void qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) }),
    onSettled: (_data, _err, vars, ctx) =>
      settleCalendarMonth(qc, ctx?.day ?? entryDay(vars.date)),
  });
}

/**
 * Update an existing entry (used by Undo — PATCH value -= 1). Matches
 * the PWA's handleUndo path in components/habits/habit-card.tsx:147 so
 * deleting an entry only happens when the user explicitly removes it
 * via the detail screen, not via Undo on the card.
 */
export type UpdateHabitEntryInput = {
  habitId: string;
  entryId: string;
  patch: Partial<Pick<HabitEntry, "value" | "type" | "notes" | "skipReason">>;
};

export function useUpdateHabitEntry() {
  const qc = useQueryClient();
  return useMutation({
    scope: ENTRY_SCOPE,
    mutationFn: async ({ habitId, entryId, patch }: UpdateHabitEntryInput) => {
      const { data } = await apiClient.patch<HabitEntry>(
        `/habits/${habitId}/entries/${entryId}`,
        patch,
      );
      return data;
    },
    // Instant flip (Undo / clear / status change) — patch the entry in
    // every cached window; the settle refetch brings server truth.
    onMutate: ({ habitId, entryId, patch }) => {
      let day: string | undefined;
      qc.setQueriesData<HabitEntry[]>(
        { queryKey: habitKeys.entries(habitId) },
        (list) =>
          Array.isArray(list)
            ? list.map((e) => {
                if (e.id !== entryId) return e;
                day = e.date?.slice(0, 10);
                return { ...e, ...patch } as HabitEntry;
              })
            : list,
      );
      return { day };
    },
    onSuccess: (server, vars) => writeServerEntry(qc, vars.habitId, server),
    onError: (_e, vars) =>
      void qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) }),
    onSettled: (_data, _err, vars, ctx) =>
      settleCalendarMonth(qc, ctx?.day ?? entryDay()),
  });
}

/**
 * Hard-delete an entry. NOT used by HabitCard / detail-screen day actions —
 * those PATCH instead of DELETE because the Mongo (userSub, habit_id, date)
 * unique index doesn't filter soft-deleted rows, so a delete+create cycle
 * E11000s on the next POST. This hook is retained for an explicit "remove
 * this entry from history" affordance (e.g. a future "delete from recent
 * entries" gesture). If you reach for it in a Skip/Fail/Undo flow, you
 * almost certainly want useUpdateHabitEntry instead.
 */
export function useDeleteHabitEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habitId,
      entryId,
    }: {
      habitId: string;
      entryId: string;
    }) => {
      await apiClient.delete(`/habits/${habitId}/entries/${entryId}`);
      return { habitId, entryId };
    },
    onSettled: (_data, _error, vars) => {
      // Cold path (explicit history delete) — entry day unknown post-delete,
      // so refresh every cached month. Everything else stays scoped.
      void qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      void qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
