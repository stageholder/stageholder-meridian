import apiClient from "@/lib/api-client";
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
import { useCallback } from "react";

export function useHabits() {
  return useOfflineQuery<Habit>(["habits"], db.habits, async () => {
    const res = await apiClient.get(`/habits`);
    return res.data?.data ?? res.data;
  });
}

export function useHabit(id: string) {
  return useOfflineQuerySingle<Habit>(
    ["habit", id],
    db.habits,
    id,
    async () => {
      const res = await apiClient.get(`/habits/${id}`);
      return res.data;
    },
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
    async () => {
      const res = await apiClient.get(`/habits/${habitId}/entries`, { params });
      return res.data;
    },
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
      unit?: string;
      color?: string;
      icon?: string;
    }
  >({
    mutationFn: async (data) => {
      const res = await apiClient.post(`/habits`, data);
      return res.data as Habit;
    },
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
        unit?: string;
        color?: string;
        icon?: string;
      };
    }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await apiClient.patch(`/habits/${id}`, data);
      return res.data as Habit;
    },
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
    mutationFn: async (id) => {
      await apiClient.delete(`/habits/${id}`);
    },
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
      data: { value?: number; notes?: string };
    }
  >({
    mutationFn: async ({ habitId, entryId, data }) => {
      const res = await apiClient.patch(
        `/habits/${habitId}/entries/${entryId}`,
        data,
      );
      return res.data as HabitEntry;
    },
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
      data: { date: string; value: number; notes?: string };
    }
  >({
    mutationFn: async ({ habitId, data }) => {
      const res = await apiClient.post(`/habits/${habitId}/entries`, data);
      return res.data as HabitEntry;
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

export function useSkipHabitEntry() {
  return useOfflineMutation<
    HabitEntry,
    {
      habitId: string;
      data: { date: string; skipReason?: string };
    }
  >({
    mutationFn: async ({ habitId, data }) => {
      const res = await apiClient.post(`/habits/${habitId}/entries`, {
        date: data.date,
        value: 0,
        type: "skip",
        skipReason: data.skipReason,
      });
      return res.data as HabitEntry;
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
