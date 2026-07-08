// Habits data layer — ONLINE-ONLY.
//
// The offline feature (Dexie cache + mutation queue) was removed wholesale and
// will be rebuilt from scratch later. These hooks used to wrap the now-deleted
// `@repo/offline` helpers (useOfflineQuery / useOfflineMutation), which layered
// a local-data fallback and an offline write queue on top of react-query. This
// layer is now plain `@tanstack/react-query`: every read hits the API, every
// write goes straight to the server. The optimistic-update UX (instant
// complete / skip / undo on the habit cards) is preserved by the standard
// TanStack cancel → snapshot → setQueryData → rollback-on-error → invalidate
// pattern instead of optimistic Dexie writes.
//
// When the offline rebuild lands it will reintroduce caching BEHIND these same
// hook names + signatures, so consumers should not need to change again.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Habit, HabitEntry } from "@repo/core/types";
import { lightKeys } from "./light";
import { habitsApi } from "./clients";

export function useHabits() {
  return useQuery<Habit[]>({
    queryKey: ["habits"],
    // The grouped/sectioned habits UI renders the FULL active set client-side,
    // so request all of it (server MAX_LIMIT=500) rather than the default first
    // page of 20 — otherwise habits past #20 silently vanish from their group.
    // Archived habits are excluded server-side.
    queryFn: () => habitsApi.list({ limit: "500" }),
  });
}

export function useHabit(id: string) {
  return useQuery<Habit>({
    queryKey: ["habit", id],
    queryFn: () => habitsApi.get(id),
    enabled: !!id,
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
  });
}

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
    }
  >({
    mutationFn: (data) => habitsApi.create(data),
    onSuccess: () => {
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
    }
  >({
    mutationFn: ({ id, data }) => habitsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      // The detail page reads ["habit", id] — a separate query nothing else
      // refreshes, so the header/stats would show stale values after an edit.
      void queryClient.invalidateQueries({ queryKey: ["habit", id] });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => habitsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

// Entry mutations all touch the same downstream surfaces (the habit summary,
// the calendar, and the gamification light/stats), so they share one
// invalidation set. Toggling a day's completion / skip / fail is the
// high-frequency interaction on the habit cards, so these optimistically patch
// the cached `["habitEntries", habitId, …]` lists before the server replies and
// roll back on error — matching the instant feel the offline Dexie writes gave.
// NOTE: `["habitEntries", habitId]` is invalidated PER MUTATION (only the
// mutated habit's entries changed) rather than the broad `["habitEntries"]`,
// which would needlessly refetch every other habit row on the page.
const HABIT_ENTRY_INVALIDATION = [
  ["habits"],
  ["calendar"],
  [...lightKeys.me],
  [...lightKeys.stats],
] as const;

// Snapshot of every cached habit-entry list (across all date-range param
// variants) so we can restore it verbatim if the mutation fails.
type HabitEntriesSnapshot = Array<
  [readonly unknown[], HabitEntry[] | undefined]
>;

export function useUpdateHabitEntry() {
  const queryClient = useQueryClient();

  return useMutation<
    HabitEntry,
    Error,
    {
      habitId: string;
      entryId: string;
      // Mirrors the API's UpdateHabitEntryDto. Allowing `type` and
      // `skipReason` here lets a caller convert an existing entry between
      // completion / skip / fail without hitting the per-(habit, date)
      // uniqueness conflict via DELETE+POST. The server enforces the
      // value=0 invariant for skip/fail and clears skipReason on
      // completion, so callers don't have to remember.
      data: {
        value?: number;
        notes?: string;
        type?: "completion" | "skip" | "fail";
        skipReason?: string;
      };
    },
    { previous: HabitEntriesSnapshot }
  >({
    mutationFn: ({ habitId, entryId, data }) =>
      habitsApi.updateEntry(habitId, entryId, data),
    onMutate: async ({ habitId, entryId, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["habitEntries", habitId],
      });

      const previous = queryClient.getQueriesData<HabitEntry[]>({
        queryKey: ["habitEntries", habitId],
        exact: false,
      });

      for (const [key, list] of previous) {
        if (!Array.isArray(list)) continue;
        queryClient.setQueryData<HabitEntry[]>(
          key,
          list.map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  ...data,
                  updatedAt: new Date().toISOString(),
                }
              : e,
          ),
        );
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: (_data, _err, { habitId }) => {
      // Only the MUTATED habit's entries changed — scope to it instead of the
      // broad `["habitEntries"]` (which refetched every habit row on the page).
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", habitId],
      });
      for (const key of HABIT_ENTRY_INVALIDATION) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
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
    mutationFn: ({ habitId, data }) => habitsApi.createEntry(habitId, data),
    onMutate: async ({ habitId, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["habitEntries", habitId],
      });

      const previous = queryClient.getQueriesData<HabitEntry[]>({
        queryKey: ["habitEntries", habitId],
        exact: false,
      });

      // A temp-id optimistic entry so the card flips to "completed" instantly.
      // onSuccess swaps in the real server entry so a fast follow-up action
      // (e.g. an immediate Undo) PATCHes a real id, not this temp one → 404.
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

      for (const [key, list] of previous) {
        if (!Array.isArray(list)) continue;
        queryClient.setQueryData<HabitEntry[]>(key, [...list, optimistic]);
      }

      return { previous, tempId };
    },
    onSuccess: (serverEntry, _vars, context) => {
      if (!context?.tempId) return;
      replaceTempEntry(queryClient, context.tempId, serverEntry);
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: (_data, _err, { habitId }) => {
      // Only the MUTATED habit's entries changed — scope to it instead of the
      // broad `["habitEntries"]` (which refetched every habit row on the page).
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", habitId],
      });
      for (const key of HABIT_ENTRY_INVALIDATION) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

// Swap an optimistic `temp-…` entry for the real server entry across every
// cached habit-entry list, so its real id is present before the mutating
// button re-enables (a follow-up PATCH/undo on a temp id would 404).
function replaceTempEntry(
  queryClient: ReturnType<typeof useQueryClient>,
  tempId: string,
  serverEntry: HabitEntry,
) {
  const caches = queryClient.getQueriesData<HabitEntry[]>({
    queryKey: ["habitEntries"],
    exact: false,
  });
  for (const [key, list] of caches) {
    if (!Array.isArray(list)) continue;
    if (!list.some((e) => e.id === tempId)) continue;
    queryClient.setQueryData<HabitEntry[]>(
      key,
      list.map((e) => (e.id === tempId ? serverEntry : e)),
    );
  }
}

export function useSkipHabitEntry() {
  const queryClient = useQueryClient();

  return useMutation<
    HabitEntry,
    Error,
    {
      habitId: string;
      data: { date: string; skipReason?: string };
    },
    { previous: HabitEntriesSnapshot; tempId: string }
  >({
    mutationFn: ({ habitId, data }) => {
      // Build via a variable so the {type, skipReason} extras flow through
      // without tripping object-literal excess property checks. The server's
      // CreateHabitEntryDto accepts these even though the factory's typed
      // payload doesn't list them — see report on `createEntry` typing.
      const payload = {
        date: data.date,
        value: 0,
        type: "skip" as const,
        skipReason: data.skipReason,
      };
      return habitsApi.createEntry(habitId, payload);
    },
    onMutate: async ({ habitId, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["habitEntries", habitId],
      });

      const previous = queryClient.getQueriesData<HabitEntry[]>({
        queryKey: ["habitEntries", habitId],
        exact: false,
      });

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

      for (const [key, list] of previous) {
        if (!Array.isArray(list)) continue;
        queryClient.setQueryData<HabitEntry[]>(key, [...list, optimistic]);
      }

      return { previous, tempId };
    },
    onSuccess: (serverEntry, _vars, context) => {
      if (!context?.tempId) return;
      replaceTempEntry(queryClient, context.tempId, serverEntry);
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: (_data, _err, { habitId }) => {
      // Only the MUTATED habit's entries changed — scope to it instead of the
      // broad `["habitEntries"]` (which refetched every habit row on the page).
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", habitId],
      });
      for (const key of HABIT_ENTRY_INVALIDATION) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
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
    {
      habitId: string;
      data: { date: string };
    },
    { previous: HabitEntriesSnapshot; tempId: string }
  >({
    mutationFn: ({ habitId, data }) => {
      const payload = {
        date: data.date,
        value: 0,
        type: "fail" as const,
      };
      return habitsApi.createEntry(habitId, payload);
    },
    onMutate: async ({ habitId, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["habitEntries", habitId],
      });

      const previous = queryClient.getQueriesData<HabitEntry[]>({
        queryKey: ["habitEntries", habitId],
        exact: false,
      });

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

      for (const [key, list] of previous) {
        if (!Array.isArray(list)) continue;
        queryClient.setQueryData<HabitEntry[]>(key, [...list, optimistic]);
      }

      return { previous, tempId };
    },
    onSuccess: (serverEntry, _vars, context) => {
      if (!context?.tempId) return;
      replaceTempEntry(queryClient, context.tempId, serverEntry);
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: (_data, _err, { habitId }) => {
      // Only the MUTATED habit's entries changed — scope to it instead of the
      // broad `["habitEntries"]` (which refetched every habit row on the page).
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", habitId],
      });
      for (const key of HABIT_ENTRY_INVALIDATION) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
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
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation<Habit, Error, string>({
    mutationFn: (id) => habitsApi.archive(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["habitsArchived"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      // Refresh the detail page (its menu label + archived banner read
      // ["habit", id]).
      void queryClient.invalidateQueries({ queryKey: ["habit", id] });
    },
  });
}

export function useUnarchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation<Habit, Error, string>({
    mutationFn: (id) => habitsApi.unarchive(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["habitsArchived"] });
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
