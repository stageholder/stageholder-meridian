import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { workspacePath } from "@/lib/api-client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Habit, HabitEntry } from "@repo/core/types";

export function useHabits() {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<Habit[]>({
    queryKey: ["habits", activeWorkspaceId],
    queryFn: async () => {
      const res = await apiClient.get(workspacePath("/habits"));
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });
}

export function useHabit(id: string) {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<Habit>({
    queryKey: ["habit", activeWorkspaceId, id],
    queryFn: async () => {
      const res = await apiClient.get(workspacePath(`/habits/${id}`));
      return res.data;
    },
    enabled: !!activeWorkspaceId && !!id,
  });
}

export function useHabitEntries(
  habitId: string,
  params?: { startDate?: string; endDate?: string }
) {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<HabitEntry[]>({
    queryKey: ["habitEntries", activeWorkspaceId, habitId, params],
    queryFn: async () => {
      const res = await apiClient.get(
        workspacePath(`/habits/${habitId}/entries`),
        { params }
      );
      return res.data;
    },
    enabled: !!activeWorkspaceId && !!habitId,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      frequency?: string;
      targetCount?: number;
      unit?: string;
      color?: string;
      icon?: string;
    }) => {
      const res = await apiClient.post(workspacePath("/habits"), data);
      return res.data as Habit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits", activeWorkspaceId] });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

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
        unit?: string;
        color?: string;
        icon?: string;
      };
    }) => {
      const res = await apiClient.patch(workspacePath(`/habits/${id}`), data);
      return res.data as Habit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits", activeWorkspaceId] });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(workspacePath(`/habits/${id}`));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits", activeWorkspaceId] });
    },
  });
}

export function useCreateHabitEntry() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async ({
      habitId,
      data,
    }: {
      habitId: string;
      data: { date: string; value: number; notes?: string };
    }) => {
      const res = await apiClient.post(
        workspacePath(`/habits/${habitId}/entries`),
        data
      );
      return res.data as HabitEntry;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["habitEntries", activeWorkspaceId, variables.habitId],
      });
      void queryClient.invalidateQueries({ queryKey: ["habits", activeWorkspaceId] });
    },
  });
}
