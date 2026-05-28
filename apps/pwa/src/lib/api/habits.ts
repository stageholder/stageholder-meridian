import type { Habit, HabitEntry } from "@repo/core/types";
import {
  useOfflineQuery,
  useOfflineQuerySingle,
  useOfflineQueryFiltered,
  useOfflineMutation,
  useOfflineDeleteMutation,
} from "@repo/offline/hooks";
import { db } from "@repo/offline/db";
import { getCurrentUserSub } from "@/lib/current-user-sub";
import { lightKeys } from "./light";
import { habitsApi } from "./clients";
import { useCallback } from "react";

export function useHabits() {
  return useOfflineQuery<Habit>(["habits"], db.habits, () => habitsApi.list());
}

export function useHabit(id: string) {
  return useOfflineQuerySingle<Habit>(
    ["habit", id],
    db.habits,
    id,
    () => habitsApi.get(id),
    { enabled: !!id },
  );
}

export function useHabitEntries(
  habitId: string,
  params?: { startDate?: string; endDate?: string },
) {
  const localQueryFn = useCallback(
    () => db.habitEntries.where("habitId").equals(habitId).toArray(),
    [habitId],
  );

  return useOfflineQueryFiltered<HabitEntry>(
    ["habitEntries", habitId, params],
    localQueryFn,
    () => habitsApi.listEntries(habitId, params),
    db.habitEntries,
    { enabled: !!habitId },
  );
}

export function useCreateHabit() {
  return useOfflineMutation<
    Habit,
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
    table: db.habits,
    entityType: "habits",
    operation: "create",
    buildPath: () => `/habits`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["habits"]],
  });
}

export function useUpdateHabit() {
  return useOfflineMutation<
    Habit,
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
    table: db.habits,
    entityType: "habits",
    operation: "update",
    buildPath: ({ id }) => `/habits/${id}`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["habits"]],
  });
}

export function useDeleteHabit() {
  return useOfflineDeleteMutation<string>({
    mutationFn: (id) => habitsApi.delete(id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: db.habits as any,
    entityType: "habits",
    buildPath: (id) => `/habits/${id}`,
    getEntityId: (id) => id,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["habits"]],
  });
}

export function useUpdateHabitEntry() {
  return useOfflineMutation<
    HabitEntry,
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
    }
  >({
    mutationFn: ({ habitId, entryId, data }) =>
      habitsApi.updateEntry(habitId, entryId, data),
    table: db.habitEntries,
    entityType: "habitEntries",
    operation: "update",
    buildPath: ({ habitId, entryId }) =>
      `/habits/${habitId}/entries/${entryId}`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [
      ["habitEntries"],
      ["habits"],
      ["calendar"],
      [...lightKeys.me],
      [...lightKeys.stats],
    ],
  });
}

export function useCreateHabitEntry() {
  return useOfflineMutation<
    HabitEntry,
    {
      habitId: string;
      data: {
        date: string;
        value: number;
        notes?: string;
        type?: "completion" | "skip" | "fail";
      };
    }
  >({
    mutationFn: ({ habitId, data }) => habitsApi.createEntry(habitId, data),
    table: db.habitEntries,
    entityType: "habitEntries",
    operation: "create",
    buildPath: ({ habitId }) => `/habits/${habitId}/entries`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [
      ["habitEntries"],
      ["habits"],
      ["calendar"],
      [...lightKeys.me],
      [...lightKeys.stats],
    ],
  });
}

export function useSkipHabitEntry() {
  return useOfflineMutation<
    HabitEntry,
    {
      habitId: string;
      data: { date: string; skipReason?: string };
    }
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
    table: db.habitEntries,
    entityType: "habitEntries",
    operation: "create",
    buildPath: ({ habitId }) => `/habits/${habitId}/entries`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [
      ["habitEntries"],
      ["habits"],
      ["calendar"],
      [...lightKeys.me],
      [...lightKeys.stats],
    ],
  });
}

// Explicitly mark a day failed (value 0, type "fail"). Unlike skip, a fail
// breaks the streak. For a day that already has an entry, PATCH it to "fail"
// via useUpdateHabitEntry instead.
export function useFailHabitEntry() {
  return useOfflineMutation<
    HabitEntry,
    {
      habitId: string;
      data: { date: string };
    }
  >({
    mutationFn: ({ habitId, data }) => {
      const payload = {
        date: data.date,
        value: 0,
        type: "fail" as const,
      };
      return habitsApi.createEntry(habitId, payload);
    },
    table: db.habitEntries,
    entityType: "habitEntries",
    operation: "create",
    buildPath: ({ habitId }) => `/habits/${habitId}/entries`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [
      ["habitEntries"],
      ["habits"],
      ["calendar"],
      [...lightKeys.me],
      [...lightKeys.stats],
    ],
  });
}
