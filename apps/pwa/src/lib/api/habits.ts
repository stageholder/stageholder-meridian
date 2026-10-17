// Habits data layer — ONLINE-ONLY.
//
// Follows the app's optimistic contract (see `optimistic.ts`): optimistic cache
// write → roll back on error → write the SERVER entry into the cache on success
// → invalidate only AGGREGATE keys (habits summary, calendar, light/stats),
// never the `["habitEntries", habitId]` list we just wrote authoritatively.
// This removes the refetch-and-revert that made checking a habit feel stale.
//
// Entry writes carry a shared mutation `scope` so they SERIALIZE (never run in
// parallel), which prevents the per-(habit,date) uniqueness 409 and orders a
// create before any follow-up update — so the controls never need disabling.
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import type { Habit, HabitEntry } from "@repo/core/types";
import { lightKeys } from "./light";
import { habitsApi } from "./clients";
import {
  snapshotAndCancel,
  rollback,
  patchLists,
  writeEntityToLists,
  removeFromLists,
  invalidateAggregates,
  type CacheSnapshot,
} from "./optimistic";

export function useHabits() {
  return useQuery<Habit[]>({
    queryKey: ["habits"],
    // The grouped/sectioned habits UI renders the FULL active set client-side,
    // so request all of it (server MAX_LIMIT=500). Archived habits are excluded
    // server-side.
    queryFn: () => habitsApi.list({ limit: "500" }),
    // Keep the last list on screen during a background refetch so the page
    // never blanks/flickers when an aggregate invalidation fires.
    placeholderData: keepPreviousData,
  });
}

/**
 * THE habits-list-with-embedded-entries aggregate (GET /habits?withEntries=90d).
 * ONE request returns every active habit already carrying its 90-day entries
 * window, so the `/habits` page's rows (`HabitListItem` / `HabitCard`) don't
 * each self-fetch their own entries — the uncapped per-habit fan-out this
 * replaces (N habits → N requests). Rows are `Habit & { entries }`, a superset
 * of `Habit`, so the page's existing sectioning/filtering/grouping keeps
 * working unchanged.
 *
 * Query-key strategy: `["habits", "withEntries", windowDays]` — a KEY UNDER
 * the `["habits"]` prefix (not a separate top-level key) so this cache rides
 * along with every existing `["habits"]`-scoped operation for free:
 *   - `useCreateHabit` / `useUpdateHabit` / `useDeleteHabit` / `useArchiveHabit`
 *     / `useUnarchiveHabit` all patch via `patchLists`/`removeFromLists`/
 *     `writeEntityToLists`, which call `qc.getQueriesData({queryKey:["habits"]})`
 *     — a PREFIX match that already includes this longer key, so their
 *     optimistic writes land here too, not just on the plain `useHabits()` list.
 *   - `useCreateHabit`'s `onSettled` `invalidateQueries({queryKey:["habits"]})`
 *     is also a prefix match, so a straggler create refetches this aggregate.
 *   - `useReorderHabits` is patched below to use the same prefix-matching
 *     helpers (it previously read/wrote the literal `["habits"]` key only,
 *     which would have left a drag-reorder invisible on this aggregate).
 */
export function useHabitsWithEntries() {
  const queryClient = useQueryClient();
  return useQuery<Array<Habit & { entries: HabitEntry[] }>>({
    // The window is FIXED at 90 days — the canonical span HabitListItem/HabitCard
    // read. It is NOT a parameter: the seed below (and the rows) always key on
    // the 90-day window, so any other span would seed data the rows never read.
    queryKey: ["habits", "withEntries", 90],
    queryFn: async () => {
      // Pass the client's LOCAL today so the server's 90-day data window is
      // anchored on the same day as the client-local seed/read window, not the
      // server's UTC day. habitsApi.list forwards arbitrary string params.
      const today = format(new Date(), "yyyy-MM-dd");
      const startDate = format(subDays(new Date(), 90), "yyyy-MM-dd");
      // Stamped BEFORE the request so the seed below can tell whether a
      // per-habit cache was written while it was in flight.
      const requestStartedAt = Date.now();
      const data = (await habitsApi.list({
        withEntries: "90d",
        today,
      })) as unknown as Array<Habit & { entries: HabitEntry[] }>;
      // Seed each habit's canonical entries window with the EXACT key shape
      // HabitListItem / HabitCard read for the today view:
      // ["habitEntries", habitId, { startDate, endDate }] — same startDate/
      // endDate computation. A structural mismatch means rows miss the cache.
      //
      // DON'T STOMP NEWER WRITES: this response reflects server state as of
      // when the request left, so a background refetch can resolve with data
      // older than an optimistic check-in made while it was in flight. Seeding
      // over that would visibly revert the row. A cold cache has no
      // `dataUpdatedAt` and always seeds — which is the case this exists for.
      for (const h of data) {
        const key = ["habitEntries", h.id, { startDate, endDate: today }];
        const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt;
        if (updatedAt && updatedAt > requestStartedAt) continue;
        queryClient.setQueryData(key, h.entries ?? []);
      }
      return data;
    },
    // Keep the last list on screen during a background refetch so the page
    // never blanks/flickers when an aggregate invalidation fires.
    placeholderData: keepPreviousData,
  });
}

export function useHabit(id: string) {
  return useQuery<Habit>({
    queryKey: ["habit", id],
    queryFn: () => habitsApi.get(id),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useHabitEntries(
  habitId: string,
  params?: { startDate?: string; endDate?: string },
) {
  return useQuery<HabitEntry[]>({
    queryKey: ["habitEntries", habitId, params],
    queryFn: () => habitsApi.listEntries(habitId, params),
    enabled: !!habitId,
    // Date-nav changes `params` (a new key); keep the prior day's entries
    // visible until the new window loads instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}

// A habit's per-day entry writes share one scope so TanStack runs them one at a
// time — no parallel POSTs (409) and create-before-update ordering.
const ENTRY_SCOPE = { id: "habit-entry" };

// A habit-entry write changes the day's status (shown from ["habitEntries"]),
// and derived surfaces we can't recompute locally. We write the server entry
// back into ["habitEntries", habitId] ourselves, so invalidate only these.
//
// NOTE: ["habits"] is DELIBERATELY absent. The habit list carries no
// entry-derived field (streaks/status are computed from the separate
// ["habitEntries", id] cache), so an entry write never needs to refresh it.
// Critically, `useHabitsWithEntries`' key is ["habits","withEntries",n] — a
// PREFIX match for ["habits"] — so invalidating ["habits"] here would refetch
// the whole /habits?withEntries aggregate and re-seed every per-habit cache on
// EVERY check-in, re-rendering the entire list (the exact cascade this refactor
// removes). Mirrors the mobile contract (entry mutations settle calendar+light
// only). Habit list-shape mutations (create/archive/reorder) invalidate
// ["habits"] themselves, which correctly covers the aggregate.
const HABIT_ENTRY_AGGREGATES = [
  ["calendar"],
  lightKeys.me,
  lightKeys.stats,
] as const;

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation<
    Habit,
    Error,
    {
      name: string;
      description?: string;
      frequency?: string;
      targetCount?: number;
      scheduledDays?: number[];
      weeklyTarget?: number;
      unit?: string;
      color?: string;
      icon?: string;
      groupId?: string | null;
    },
    { previous: CacheSnapshot; tempId: string }
  >({
    mutationFn: (data) => habitsApi.create(data),
    onMutate: async (data) => {
      const previous = await snapshotAndCancel(queryClient, [["habits"]]);
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        ...data,
        order: Number.MAX_SAFE_INTEGER,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Habit;
      patchLists<Habit>(queryClient, [["habits"]], (l) => [...l, optimistic]);
      return { previous, tempId };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverHabit, _v, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(queryClient, [["habits"]], serverHabit, ctx.tempId);
    },
    onSettled: () => {
      // Pick up server ordering / group placement for the new row.
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation<
    Habit,
    Error,
    {
      id: string;
      data: {
        name?: string;
        description?: string;
        frequency?: string;
        targetCount?: number;
        scheduledDays?: number[] | null;
        weeklyTarget?: number;
        unit?: string;
        color?: string;
        icon?: string;
        groupId?: string | null;
      };
    },
    { previous: CacheSnapshot }
  >({
    mutationFn: ({ id, data }) => habitsApi.update(id, data),
    onMutate: async ({ id, data }) => {
      const previous = await snapshotAndCancel(queryClient, [
        ["habits"],
        ["habit", id],
      ]);
      patchLists<Habit>(queryClient, [["habits"]], (l) =>
        l.map((h) => (h.id === id ? ({ ...h, ...data } as Habit) : h)),
      );
      const detail = queryClient.getQueryData<Habit>(["habit", id]);
      if (detail)
        queryClient.setQueryData(["habit", id], { ...detail, ...data });
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverHabit, { id }) => {
      writeEntityToLists(queryClient, [["habits"]], serverHabit);
      queryClient.setQueryData(["habit", id], serverHabit);
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previous: CacheSnapshot }>({
    mutationFn: (id) => habitsApi.delete(id),
    onMutate: async (id) => {
      const previous = await snapshotAndCancel(queryClient, [["habits"]]);
      removeFromLists<Habit>(queryClient, [["habits"]], id);
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// Snapshot of every cached habit-entry list (across all date-range param
// variants) so an optimistic write can be restored verbatim on error.
type HabitEntriesSnapshot = CacheSnapshot;

/** Patch (or replace) a single entry across every cached habitEntries list. */
function patchEntry(
  queryClient: ReturnType<typeof useQueryClient>,
  habitId: string,
  entryId: string,
  producer: (e: HabitEntry) => HabitEntry,
) {
  patchLists<HabitEntry>(queryClient, [["habitEntries", habitId]], (list) =>
    list.map((e) => (e.id === entryId ? producer(e) : e)),
  );
}

export function useUpdateHabitEntry() {
  const queryClient = useQueryClient();

  return useMutation<
    HabitEntry,
    Error,
    {
      habitId: string;
      entryId: string;
      data: {
        value?: number;
        notes?: string;
        type?: "completion" | "skip" | "fail";
        skipReason?: string;
      };
    },
    { previous: HabitEntriesSnapshot }
  >({
    scope: ENTRY_SCOPE,
    mutationFn: ({ habitId, entryId, data }) =>
      habitsApi.updateEntry(habitId, entryId, data),
    onMutate: async ({ habitId, entryId, data }) => {
      const previous = await snapshotAndCancel(queryClient, [
        ["habitEntries", habitId],
      ]);
      patchEntry(queryClient, habitId, entryId, (e) => ({
        ...e,
        ...data,
        updatedAt: new Date().toISOString(),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => rollback(queryClient, ctx?.previous),
    // Write the server entry back into the entries cache — no re-fetch/revert.
    onSuccess: (serverEntry, { habitId }) => {
      writeEntityToLists(queryClient, [["habitEntries", habitId]], serverEntry);
    },
    onSettled: () => invalidateAggregates(queryClient, HABIT_ENTRY_AGGREGATES),
  });
}

export function useCreateHabitEntry() {
  const queryClient = useQueryClient();

  return useMutation<
    HabitEntry,
    Error,
    {
      habitId: string;
      data: {
        date: string;
        value: number;
        notes?: string;
        type?: "completion" | "skip" | "fail";
      };
    },
    { previous: HabitEntriesSnapshot; tempId: string }
  >({
    scope: ENTRY_SCOPE,
    mutationFn: ({ habitId, data }) => habitsApi.createEntry(habitId, data),
    onMutate: async ({ habitId, data }) => {
      const previous = await snapshotAndCancel(queryClient, [
        ["habitEntries", habitId],
      ]);
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        habitId,
        date: data.date,
        value: data.value,
        notes: data.notes,
        type: data.type ?? "completion",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as HabitEntry;
      patchLists<HabitEntry>(queryClient, [["habitEntries", habitId]], (l) => [
        ...l,
        optimistic,
      ]);
      return { previous, tempId };
    },
    onError: (_err, _vars, ctx) => rollback(queryClient, ctx?.previous),
    // Swap the temp entry for the real server entry so a follow-up action
    // PATCHes a real id (not a temp id → 404).
    onSuccess: (serverEntry, { habitId }, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(
          queryClient,
          [["habitEntries", habitId]],
          serverEntry,
          ctx.tempId,
        );
    },
    onSettled: () => invalidateAggregates(queryClient, HABIT_ENTRY_AGGREGATES),
  });
}

export function useSkipHabitEntry() {
  const queryClient = useQueryClient();

  return useMutation<
    HabitEntry,
    Error,
    { habitId: string; data: { date: string; skipReason?: string } },
    { previous: HabitEntriesSnapshot; tempId: string }
  >({
    scope: ENTRY_SCOPE,
    mutationFn: ({ habitId, data }) =>
      habitsApi.createEntry(habitId, {
        date: data.date,
        value: 0,
        type: "skip" as const,
        skipReason: data.skipReason,
      }),
    onMutate: async ({ habitId, data }) => {
      const previous = await snapshotAndCancel(queryClient, [
        ["habitEntries", habitId],
      ]);
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        habitId,
        date: data.date,
        value: 0,
        type: "skip",
        skipReason: data.skipReason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as HabitEntry;
      patchLists<HabitEntry>(queryClient, [["habitEntries", habitId]], (l) => [
        ...l,
        optimistic,
      ]);
      return { previous, tempId };
    },
    onError: (_err, _vars, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverEntry, { habitId }, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(
          queryClient,
          [["habitEntries", habitId]],
          serverEntry,
          ctx.tempId,
        );
    },
    onSettled: () => invalidateAggregates(queryClient, HABIT_ENTRY_AGGREGATES),
  });
}

// Explicitly mark a day failed (value 0, type "fail"). Unlike skip, a fail
// breaks the streak. For a day that already has an entry, PATCH it to "fail"
// via useUpdateHabitEntry instead.
export function useFailHabitEntry() {
  const queryClient = useQueryClient();

  return useMutation<
    HabitEntry,
    Error,
    { habitId: string; data: { date: string } },
    { previous: HabitEntriesSnapshot; tempId: string }
  >({
    scope: ENTRY_SCOPE,
    mutationFn: ({ habitId, data }) =>
      habitsApi.createEntry(habitId, {
        date: data.date,
        value: 0,
        type: "fail" as const,
      }),
    onMutate: async ({ habitId, data }) => {
      const previous = await snapshotAndCancel(queryClient, [
        ["habitEntries", habitId],
      ]);
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        habitId,
        date: data.date,
        value: 0,
        type: "fail",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as HabitEntry;
      patchLists<HabitEntry>(queryClient, [["habitEntries", habitId]], (l) => [
        ...l,
        optimistic,
      ]);
      return { previous, tempId };
    },
    onError: (_err, _vars, ctx) => rollback(queryClient, ctx?.previous),
    onSuccess: (serverEntry, { habitId }, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(
          queryClient,
          [["habitEntries", habitId]],
          serverEntry,
          ctx.tempId,
        );
    },
    onSettled: () => invalidateAggregates(queryClient, HABIT_ENTRY_AGGREGATES),
  });
}

export function useReorderHabits() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { items: { id: string; order: number; groupId?: string | null }[] },
    { previous: CacheSnapshot }
  >({
    mutationFn: (data) => habitsApi.reorder(data),
    // Optimistically apply the new order/group so the grouped list holds the
    // dropped position instead of snapping back until the refetch lands.
    // Uses the shared prefix-matching helpers (not a literal ["habits"] get/set)
    // so the drag order lands on EVERY cached ["habits", ...] variant —
    // including `useHabitsWithEntries`'s `["habits", "withEntries", n]` — not
    // just the plain `useHabits()` list.
    onMutate: async ({ items }) => {
      const previous = await snapshotAndCancel(queryClient, [["habits"]]);
      const patchById = new Map(items.map((i) => [i.id, i]));
      patchLists<Habit>(queryClient, [["habits"]], (list) =>
        list.map((h) => {
          const p = patchById.get(h.id);
          if (!p) return h;
          return {
            ...h,
            order: p.order,
            ...(p.groupId !== undefined ? { groupId: p.groupId } : {}),
          };
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => rollback(queryClient, context?.previous),
    // No settle-refetch: the optimistic order already matches the server's.
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation<Habit, Error, string, { previous: CacheSnapshot }>({
    mutationFn: (id) => habitsApi.archive(id),
    // Archived habits are excluded from ["habits"], so drop the row instantly.
    onMutate: async (id) => {
      const previous = await snapshotAndCancel(queryClient, [["habits"]]);
      removeFromLists<Habit>(queryClient, [["habits"]], id);
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSettled: (_data, _err, id) => {
      void queryClient.invalidateQueries({ queryKey: ["habitsArchived"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["habit", id] });
    },
  });
}

export function useUnarchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation<Habit, Error, string, { previous: CacheSnapshot }>({
    mutationFn: (id) => habitsApi.unarchive(id),
    onMutate: async (id) => {
      const previous = await snapshotAndCancel(queryClient, [
        ["habitsArchived"],
      ]);
      removeFromLists<Habit>(queryClient, [["habitsArchived"]], id);
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(queryClient, ctx?.previous),
    onSettled: (_data, _err, id) => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["habit", id] });
    },
  });
}

export function useArchivedHabits() {
  return useQuery<Habit[]>({
    queryKey: ["habitsArchived"],
    queryFn: () => habitsApi.list({ archivedOnly: "true" }),
  });
}
