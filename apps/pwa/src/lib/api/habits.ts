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
    queryFn: () => habitsApi.list(),
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
      };
    }
  >({
    mutationFn: ({ id, data }) => habitsApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
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

// Entry mutations all touch the same downstream surfaces (the entry list, the
// habit summary, the calendar, and the gamification light/stats), so they share
// one invalidation set. Toggling a day's completion / skip / fail is the
// high-frequency interaction on the habit cards, so these optimistically patch
// the cached `["habitEntries", habitId, …]` lists before the server replies and
// roll back on error — matching the instant feel the offline Dexie writes gave.
const HABIT_ENTRY_INVALIDATION = [
  ["habitEntries"],
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
    onSettled: () => {
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
    { previous: HabitEntriesSnapshot }
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

      // A temp-id optimistic entry so the card flips to "completed" instantly;
      // onSettled refetch replaces it with the server's real entry.
      const optimistic = {
        id: `temp-${Date.now()}`,
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

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: () => {
      for (const key of HABIT_ENTRY_INVALIDATION) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
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
    { previous: HabitEntriesSnapshot }
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

      const optimistic = {
        id: `temp-${Date.now()}`,
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

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: () => {
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
    { previous: HabitEntriesSnapshot }
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

      const optimistic = {
        id: `temp-${Date.now()}`,
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

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return;
      for (const [key, list] of context.previous) {
        queryClient.setQueryData(key, list);
      }
    },
    onSettled: () => {
      for (const key of HABIT_ENTRY_INVALIDATION) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
