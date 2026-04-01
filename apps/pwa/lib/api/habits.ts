import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { Habit, HabitEntry } from "@repo/core/types";
import {
  useOfflineQuery,
  useOfflineQuerySingle,
  useOfflineQueryFiltered,
  useOfflineMutation,
  useOfflineDeleteMutation,
} from "@repo/offline/hooks";
import { db } from "@repo/offline/db";
import { lightKeys } from "./light";
import { useCallback } from "react";

export function useHabits() {
  const { workspace } = useWorkspace();

  return useOfflineQuery<Habit>(
    ["habits", workspace.id],
    db.habits,
    async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/habits`);
      return res.data?.data ?? res.data;
    },
  );
}

export function useHabit(id: string) {
  const { workspace } = useWorkspace();

  return useOfflineQuerySingle<Habit>(
    ["habit", workspace.id, id],
    db.habits,
    id,
    async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/habits/${id}`,
      );
      return res.data;
    },
    { enabled: !!id },
  );
}

export function useHabitEntries(
  habitId: string,
  params?: { startDate?: string; endDate?: string },
) {
  const { workspace } = useWorkspace();

  const localQueryFn = useCallback(
    () => db.habitEntries.where("habitId").equals(habitId).toArray(),
    [habitId],
  );

  return useOfflineQueryFiltered<HabitEntry>(
    ["habitEntries", workspace.id, habitId, params],
    localQueryFn,
    async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/habits/${habitId}/entries`,
        { params },
      );
      return res.data;
    },
    db.habitEntries,
    { enabled: !!habitId },
  );
}

export function useCreateHabit() {
  const { workspace } = useWorkspace();

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
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/habits`,
        data,
      );
      return res.data as Habit;
    },
    table: db.habits,
    entityType: "habits",
    operation: "create",
    buildPath: () => `/workspaces/${workspace.id}/habits`,
    invalidateKeys: [["habits", workspace.id]],
  });
}

export function useUpdateHabit() {
  const { workspace } = useWorkspace();

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
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/habits/${id}`,
        data,
      );
      return res.data as Habit;
    },
    table: db.habits,
    entityType: "habits",
    operation: "update",
    buildPath: ({ id }) => `/workspaces/${workspace.id}/habits/${id}`,
    invalidateKeys: [["habits", workspace.id]],
  });
}

export function useDeleteHabit() {
  const { workspace } = useWorkspace();

  return useOfflineDeleteMutation<string>({
    mutationFn: async (id) => {
      await apiClient.delete(`/workspaces/${workspace.id}/habits/${id}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: db.habits as any,
    entityType: "habits",
    buildPath: (id) => `/workspaces/${workspace.id}/habits/${id}`,
    getEntityId: (id) => id,
    invalidateKeys: [["habits", workspace.id]],
  });
}

export function useUpdateHabitEntry() {
  const { workspace } = useWorkspace();

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
        `/workspaces/${workspace.id}/habits/${habitId}/entries/${entryId}`,
        data,
      );
      return res.data as HabitEntry;
    },
    table: db.habitEntries,
    entityType: "habitEntries",
    operation: "update",
    buildPath: ({ habitId, entryId }) =>
      `/workspaces/${workspace.id}/habits/${habitId}/entries/${entryId}`,
    invalidateKeys: [
      ["habitEntries", workspace.id],
      ["habits", workspace.id],
      ["calendar"],
      [...lightKeys.me],
      [...lightKeys.stats],
    ],
  });
}

export function useCreateHabitEntry() {
  const { workspace } = useWorkspace();

  return useOfflineMutation<
    HabitEntry,
    {
      habitId: string;
      data: { date: string; value: number; notes?: string };
    }
  >({
    mutationFn: async ({ habitId, data }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/habits/${habitId}/entries`,
        data,
      );
      return res.data as HabitEntry;
    },
    table: db.habitEntries,
    entityType: "habitEntries",
    operation: "create",
    buildPath: ({ habitId }) =>
      `/workspaces/${workspace.id}/habits/${habitId}/entries`,
    invalidateKeys: [
      ["habitEntries", workspace.id],
      ["habits", workspace.id],
      ["calendar"],
      [...lightKeys.me],
      [...lightKeys.stats],
    ],
  });
}

export function useSkipHabitEntry() {
  const { workspace } = useWorkspace();

  return useOfflineMutation<
    HabitEntry,
    {
      habitId: string;
      data: { date: string; skipReason?: string };
    }
  >({
    mutationFn: async ({ habitId, data }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/habits/${habitId}/entries`,
        {
          date: data.date,
          value: 0,
          type: "skip",
          skipReason: data.skipReason,
        },
      );
      return res.data as HabitEntry;
    },
    table: db.habitEntries,
    entityType: "habitEntries",
    operation: "create",
    buildPath: ({ habitId }) =>
      `/workspaces/${workspace.id}/habits/${habitId}/entries`,
    invalidateKeys: [
      ["habitEntries", workspace.id],
      ["habits", workspace.id],
      ["calendar"],
      [...lightKeys.me],
      [...lightKeys.stats],
    ],
  });
}
