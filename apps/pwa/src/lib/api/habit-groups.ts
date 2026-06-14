import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HabitGroup } from "@repo/core/types";
import { habitsApi } from "./clients";

export const habitGroupKeys = {
  all: ["habitGroups"] as const,
};

export function useHabitGroups() {
  return useQuery<HabitGroup[]>({
    queryKey: habitGroupKeys.all,
    queryFn: () => habitsApi.listGroups(),
  });
}

export function useCreateHabitGroup() {
  const qc = useQueryClient();
  return useMutation<
    HabitGroup,
    Error,
    { name: string; color?: string; icon?: string }
  >({
    mutationFn: (data) => habitsApi.createGroup(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
    },
  });
}

export function useUpdateHabitGroup() {
  const qc = useQueryClient();
  return useMutation<
    HabitGroup,
    Error,
    { id: string; data: { name?: string; color?: string; icon?: string } }
  >({
    mutationFn: ({ id, data }) => habitsApi.updateGroup(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
    },
  });
}

export function useDeleteHabitGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => habitsApi.deleteGroup(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
      // Deleting a group orphans its habits → refresh the habit list too.
      void qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useReorderHabitGroups() {
  const qc = useQueryClient();
  return useMutation<void, Error, { items: { id: string; order: number }[] }>({
    mutationFn: (data) => habitsApi.reorderGroups(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
    },
  });
}
