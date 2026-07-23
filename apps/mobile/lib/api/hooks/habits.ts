// apps/mobile/lib/api/hooks/habits.ts
//
// React Query hooks for /habits and /habits/:id/entries.
// Field names align with @repo/core/types — habit has `name` (not title),
// `targetCount` (not target), `frequency`, no inline checkIns. Per-day
// state lives in HabitEntry rows fetched via useHabitEntries.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import type { Habit, HabitEntry } from "@repo/core/types";

import { apiClient } from "../client";
import { writeHabitEntryToCalendar } from "../calendar-cache";
import { habitKeys } from "../keys";
import {
  snapshotAndCancel,
  rollback,
  patchLists,
  writeEntityToLists,
  ENTRY_SCOPE,
  type CacheSnapshot,
} from "../optimistic";

/** Replace whichever cached entry shares the server entry's day with the
 *  authoritative server record, across the base + windowed entries caches — so
 *  a check-in never needs to re-fetch (and briefly revert) the entries list. */
function writeEntryByDate(
  qc: ReturnType<typeof useQueryClient>,
  habitId: string,
  serverEntry: HabitEntry,
) {
  const day = serverEntry.date?.slice(0, 10);
  patchLists<HabitEntry>(qc, [habitKeys.entries(habitId)], (list) => {
    let replaced = false;
    const next = list.map((e) => {
      if (e.date?.slice(0, 10) === day) {
        replaced = true;
        return serverEntry;
      }
      return e;
    });
    return replaced ? next : [...next, serverEntry];
  });
}

/**
 * Recover gracefully when a POST to /habits/:id/entries races another
 * client and lands on an active entry the API refuses to overwrite (409).
 * We refetch entries so the next render's smart handlers will PATCH the
 * fresh entry instead, and we surface a single human-readable error.
 *
 * Returns true if the error WAS a 409 (caller should suppress its own
 * generic error toast in favor of the more accurate "refreshed" message).
 */
function isAxios409(err: unknown): boolean {
  // axios attaches `response.status`; keep the shape check loose so this
  // works whether axios, fetch, or a test mock surfaces the error.
  const e = err as { response?: { status?: number }; status?: number };
  return e?.response?.status === 409 || e?.status === 409;
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
  // Explicit generics: RQ v5.100's 4-arg callbacks infer TVariables/TContext
  // across ALL handlers — per-handler param annotations (the old pattern
  // here) poison that inference into `unknown` and fail the typecheck.
  return useMutation<
    Habit,
    Error,
    CreateHabitInput,
    { previous: CacheSnapshot; tempId: string }
  >({
    mutationFn: async (input) => {
      const { data } = await apiClient.post<Habit>("/habits", {
        frequency: "daily",
        targetCount: 1,
        ...input,
      });
      return data;
    },
    // Optimistic temp row so a new habit shows the instant you submit.
    onMutate: async (input) => {
      const previous = await snapshotAndCancel(qc, [habitKeys.lists()]);
      const tempId = `optimistic-${Date.now()}`;
      const optimistic = {
        id: tempId,
        frequency: "daily",
        targetCount: 1,
        ...input,
        order: Number.MAX_SAFE_INTEGER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Habit;
      patchLists<Habit>(qc, [habitKeys.lists()], (l) => [...l, optimistic]);
      return { previous, tempId };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.previous),
    onSuccess: (server, _v, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(qc, [habitKeys.lists()], server, ctx.tempId);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: habitKeys.lists() }),
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
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: habitKeys.lists() });
      const snapshots = qc.getQueriesData<Habit[]>({
        queryKey: habitKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Habit[]>(
          key,
          prev.filter((h) => h.id !== id),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
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
  // Explicit generics — see useCreateHabit for why (RQ v5.100 inference).
  return useMutation<
    void,
    Error,
    { items: { id: string; order: number; groupId?: string | null }[] },
    { previous: CacheSnapshot }
  >({
    mutationFn: async (data) => {
      await apiClient.post("/habits/reorder", data);
    },
    // Optimistically apply the new order/group so a dropped habit holds its
    // position instead of snapping back until the refetch lands.
    onMutate: async ({ items }) => {
      const previous = await snapshotAndCancel(qc, [habitKeys.lists()]);
      const patchById = new Map(items.map((i) => [i.id, i]));
      patchLists<Habit>(qc, [habitKeys.lists()], (l) =>
        l.map((h) => {
          const p = patchById.get(h.id);
          if (!p) return h;
          return {
            ...h,
            order: p.order,
            ...(p.groupId !== undefined ? { groupId: p.groupId } : {}),
          } as Habit;
        }),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.previous),
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
    // Serialize per-habit-day entry writes so rapid taps can't race into a
    // duplicate POST (409) or a stale-id PATCH — without disabling the control.
    scope: ENTRY_SCOPE,
    mutationFn: async (input: CheckInInput) => {
      const { data } = await apiClient.post<HabitEntry>(
        `/habits/${input.habitId}/entries`,
        { date: input.date, value: input.value ?? 1, type: "completion" },
      );
      return data;
    },
    onMutate: async (input) => {
      // Prefix-match EVERY entries window (base + windowed, e.g. the habits
      // screen's 90-day fetch and the calendar/agenda day windows) so the
      // optimistic flip is instant on whichever surface is mounted — not just
      // the un-windowed query. Mirrors writeEntryByDate's prefix write.
      const previous = await snapshotAndCancel(qc, [
        habitKeys.entries(input.habitId),
      ]);
      const day = input.date ?? new Date().toISOString().slice(0, 10);
      const inc = input.value ?? 1;
      patchLists<HabitEntry>(qc, [habitKeys.entries(input.habitId)], (list) => {
        const existing = list.find((e) => e.date.slice(0, 10) === day);
        if (existing) {
          return list.map((e) =>
            e.date.slice(0, 10) === day
              ? { ...e, value: (e.value ?? 0) + inc }
              : e,
          );
        }
        return [
          ...list,
          {
            id: `optimistic-${day}`,
            habitId: input.habitId,
            userSub: "",
            date: day,
            value: inc,
            type: "completion" as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as HabitEntry,
        ];
      });
      return { previous };
    },
    onError: (err, vars, ctx) => {
      rollback(qc, ctx?.previous);
      // 409 = another client raced us and created an entry first. Force a
      // refetch so the next render's smart handlers PATCH the live entry.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    // Write the server entry into the entries cache AND the one affected
    // calendar month — no refetch anywhere. The old onSettled here broadly
    // invalidated habitKeys.lists() (pure waste: Habit rows carry NO
    // entry-derived fields — streaks are client-computed from entries) and
    // ["calendar"] (refetched all ~7 cached months, whose new array
    // identities defeated every row memo → whole-app re-render per tap).
    onSuccess: (server, vars) => {
      writeEntryByDate(qc, vars.habitId, server);
      writeHabitEntryToCalendar(qc, server);
    },
  });
}

/**
 * Optimistic insert of a value-0 entry of the given type. Used by skip + fail
 * so the UI flips instantly. Returns the rollback context for onError.
 */
function optimisticInsertNonCompletion(
  qc: ReturnType<typeof useQueryClient>,
  habitId: string,
  date: string | undefined,
  type: "skip" | "fail",
  skipReason?: string,
) {
  const d = date ?? new Date().toISOString().slice(0, 10);
  // Snapshot every entries window for rollback (the caller has already
  // cancelled in-flight fetches on the same prefix).
  const previous = qc.getQueriesData({
    queryKey: habitKeys.entries(habitId),
  }) as CacheSnapshot;
  // Patch ALL windows (base + windowed) so the flip is instant on whichever
  // surface is mounted — parity with the check-in path + writeEntryByDate.
  patchLists<HabitEntry>(qc, [habitKeys.entries(habitId)], (list) => {
    const existing = list.find((e) => e.date.slice(0, 10) === d);
    if (existing) {
      return list.map((e) =>
        e.date.slice(0, 10) === d
          ? ({ ...e, type, value: 0, skipReason } as HabitEntry)
          : e,
      );
    }
    return [
      ...list,
      {
        id: `optimistic-${type}-${d}`,
        habitId,
        userSub: "",
        date: d,
        value: 0,
        type,
        skipReason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as HabitEntry,
    ];
  });
  return { previous };
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
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: habitKeys.entries(input.habitId) });
      return optimisticInsertNonCompletion(
        qc,
        input.habitId,
        input.date,
        "skip",
        input.reason,
      );
    },
    onError: (err, vars, ctx) => {
      rollback(qc, ctx?.previous);
      // 409 = race with another client. Refetch so the next attempt sees
      // the live entry and PATCHes it instead of POSTing again.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    // Write the server entry into the entries cache AND the one affected
    // calendar month — no refetch anywhere (see useCheckInHabit).
    onSuccess: (server, vars) => {
      writeEntryByDate(qc, vars.habitId, server);
      writeHabitEntryToCalendar(qc, server);
    },
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
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: habitKeys.entries(input.habitId) });
      return optimisticInsertNonCompletion(
        qc,
        input.habitId,
        input.date,
        "fail",
      );
    },
    onError: (err, vars, ctx) => {
      rollback(qc, ctx?.previous);
      // 409 = race with another client. Refetch so the next attempt sees
      // the live entry and PATCHes it instead of POSTing again.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    // Write the server entry into the entries cache AND the one affected
    // calendar month — no refetch anywhere (see useCheckInHabit).
    onSuccess: (server, vars) => {
      writeEntryByDate(qc, vars.habitId, server);
      writeHabitEntryToCalendar(qc, server);
    },
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
    onMutate: async ({ habitId, entryId, patch }) => {
      // Prefix-match every entries window so an Undo / clear / status change
      // flips instantly on whichever surface is mounted.
      const previous = await snapshotAndCancel(qc, [
        habitKeys.entries(habitId),
      ]);
      patchLists<HabitEntry>(qc, [habitKeys.entries(habitId)], (list) =>
        list.map((e) =>
          e.id === entryId ? ({ ...e, ...patch } as HabitEntry) : e,
        ),
      );
      return { previous };
    },
    onError: (err, vars, ctx) => {
      rollback(qc, ctx?.previous);
      // 409 = race with another client. Refetch so the next attempt sees
      // the live entry and PATCHes it instead of POSTing again.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    // Write the server entry into the entries cache AND the one affected
    // calendar month — no refetch anywhere (see useCheckInHabit).
    onSuccess: (server, vars) => {
      writeEntryByDate(qc, vars.habitId, server);
      writeHabitEntryToCalendar(qc, server);
    },
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
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
      // The habits screen's To-do/Done sectioning is derived from the calendar
      // month query (useCalendarData), so refresh it too — otherwise a
      // check-in flips the card but its section stays stale (H3).
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
