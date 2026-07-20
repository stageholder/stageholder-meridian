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
const HABIT_ENTRY_AGGREGATES = [
  ["habits"],
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
    { previous: Habit[] | undefined }
  >({
    mutationFn: (data) => habitsApi.reorder(data),
    // Optimistically apply the new order/group so the grouped list holds the
    // dropped position instead of snapping back until the refetch lands.
    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const previous = queryClient.getQueryData<Habit[]>(["habits"]);
      if (Array.isArray(previous)) {
        const patchById = new Map(items.map((i) => [i.id, i]));
        queryClient.setQueryData<Habit[]>(
          ["habits"],
          previous.map((h) => {
            const p = patchById.get(h.id);
            if (!p) return h;
            return {
              ...h,
              order: p.order,
              ...(p.groupId !== undefined ? { groupId: p.groupId } : {}),
            };
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["habits"], context.previous);
    },
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
