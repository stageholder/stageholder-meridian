import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { Habit, HabitEntry } from "@repo/core/types";
import { lightKeys } from "./light";

export function useHabits() {
  const { workspace } = useWorkspace();

  return useQuery<Habit[]>({
    queryKey: ["habits", workspace.id],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/habits`);
      return res.data?.data ?? res.data;
    },
  });
}

export function useHabit(id: string) {
  const { workspace } = useWorkspace();

  return useQuery<Habit>({
    queryKey: ["habit", workspace.id, id],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/habits/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useHabitEntries(
  habitId: string,
  params?: { startDate?: string; endDate?: string }
) {
  const { workspace } = useWorkspace();

  return useQuery<HabitEntry[]>({
    queryKey: ["habitEntries", workspace.id, habitId, params],
    queryFn: async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/habits/${habitId}/entries`,
        { params }
      );
      return res.data;
    },
    enabled: !!habitId,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      frequency?: string;
      targetCount?: number;
      scheduledDays?: number[];
      unit?: string;
      color?: string;
      icon?: string;
    }) => {
      const res = await apiClient.post(`/workspaces/${workspace.id}/habits`, data);
      return res.data as Habit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits", workspace.id] });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
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
    }) => {
      const res = await apiClient.patch(`/workspaces/${workspace.id}/habits/${id}`, data);
      return res.data as Habit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits", workspace.id] });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workspaces/${workspace.id}/habits/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits", workspace.id] });
    },
  });
}

export function useUpdateHabitEntry() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      habitId,
      entryId,
      data,
    }: {
      habitId: string;
      entryId: string;
      data: { value?: number; notes?: string };
    }) => {
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/habits/${habitId}/entries/${entryId}`,
        data
      );
      return res.data as HabitEntry;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", workspace.id, variables.habitId],
      });
      void queryClient.invalidateQueries({ queryKey: ["habits", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
    },
  });
}

export function useCreateHabitEntry() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      habitId,
      data,
    }: {
      habitId: string;
      data: { date: string; value: number; notes?: string };
    }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/habits/${habitId}/entries`,
        data
      );
      return res.data as HabitEntry;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", workspace.id, variables.habitId],
      });
      void queryClient.invalidateQueries({ queryKey: ["habits", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
    },
  });
}

export function useSkipHabitEntry() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      habitId,
      data,
    }: {
      habitId: string;
      data: { date: string; skipReason?: string };
    }) => {
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/habits/${habitId}/entries`,
        { date: data.date, value: 0, type: "skip", skipReason: data.skipReason }
      );
      return res.data as HabitEntry;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", workspace.id, variables.habitId],
      });
      void queryClient.invalidateQueries({ queryKey: ["habits", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
    },
  });
}
