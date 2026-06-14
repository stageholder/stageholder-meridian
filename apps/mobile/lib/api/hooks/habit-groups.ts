// apps/mobile/lib/api/hooks/habit-groups.ts
//
// React Query hooks for the /habit-groups resource — the native counterpart of
// the PWA's apps/pwa/src/lib/api/habit-groups.ts. Mirrors the mobile hook style
// (raw `apiClient` axios + the `keys.ts` factory) rather than the PWA's
// core-factory binding, matching every other hook in this folder
// (hooks/habits.ts, hooks/todos.ts).
//
// The server seeds four time-of-day groups (Morning/Afternoon/Evening/Anytime)
// on the first list call; thereafter they behave like any user group. Deleting
// a group orphans its habits (group_id → null) server-side, so deleteGroup also
// invalidates the habit list.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HabitGroup } from "@repo/core/types";

import { apiClient } from "../client";
import { habitGroupKeys, habitKeys } from "../keys";

/* ------------------------------ Reads -------------------------------- */

export function useHabitGroups() {
  return useQuery({
    queryKey: habitGroupKeys.all,
    queryFn: async () => {
      const { data } = await apiClient.get<
        { data: HabitGroup[] } | HabitGroup[]
      >("/habit-groups");
      return Array.isArray(data) ? data : data.data;
    },
  });
}

/* ---------------------------- Mutations ------------------------------ */

export type HabitGroupInput = { name: string; color?: string; icon?: string };

export function useCreateHabitGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HabitGroupInput) => {
      const { data } = await apiClient.post<HabitGroup>("/habit-groups", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitGroupKeys.all }),
  });
}

export function useUpdateHabitGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<HabitGroupInput>;
    }) => {
      const { data } = await apiClient.patch<HabitGroup>(
        `/habit-groups/${id}`,
        patch,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitGroupKeys.all }),
  });
}

export function useDeleteHabitGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/habit-groups/${id}`);
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
      // Deleting a group orphans its habits (group_id → null) → refresh the
      // habit list so the orphaned habits fall into the Ungrouped section.
      void qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

export function useReorderHabitGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { items: { id: string; order: number }[] }) => {
      await apiClient.post("/habit-groups/reorder", data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitGroupKeys.all }),
  });
}
