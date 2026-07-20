import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HabitGroup } from "@repo/core/types";
import { habitsApi } from "./clients";
import {
  snapshotAndCancel,
  rollback,
  patchLists,
  writeEntityToLists,
  removeFromLists,
  type CacheSnapshot,
} from "./optimistic";

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
    { name: string; color?: string; icon?: string },
    { previous: CacheSnapshot; tempId: string }
  >({
    mutationFn: (data) => habitsApi.createGroup(data),
    onMutate: async (data) => {
      const previous = await snapshotAndCancel(qc, [habitGroupKeys.all]);
      const tempId = `temp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        ...data,
        order: Number.MAX_SAFE_INTEGER,
      } as unknown as HabitGroup;
      patchLists<HabitGroup>(qc, [habitGroupKeys.all], (l) => [
        ...l,
        optimistic,
      ]);
      return { previous, tempId };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.previous),
    onSuccess: (server, _v, ctx) => {
      if (ctx?.tempId)
        writeEntityToLists(qc, [habitGroupKeys.all], server, ctx.tempId);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
    },
  });
}

export function useUpdateHabitGroup() {
  const qc = useQueryClient();
  return useMutation<
    HabitGroup,
    Error,
    { id: string; data: { name?: string; color?: string; icon?: string } },
    { previous: CacheSnapshot }
  >({
    mutationFn: ({ id, data }) => habitsApi.updateGroup(id, data),
    onMutate: async ({ id, data }) => {
      const previous = await snapshotAndCancel(qc, [habitGroupKeys.all]);
      patchLists<HabitGroup>(qc, [habitGroupKeys.all], (l) =>
        l.map((g) => (g.id === id ? ({ ...g, ...data } as HabitGroup) : g)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.previous),
    onSuccess: (server) => writeEntityToLists(qc, [habitGroupKeys.all], server),
  });
}

export function useDeleteHabitGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, string, { previous: CacheSnapshot }>({
    mutationFn: (id) => habitsApi.deleteGroup(id),
    onMutate: async (id) => {
      const previous = await snapshotAndCancel(qc, [habitGroupKeys.all]);
      removeFromLists<HabitGroup>(qc, [habitGroupKeys.all], id);
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.previous),
    onSettled: () => {
      // Deleting a group orphans its habits → refresh the habit list too.
      void qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useReorderHabitGroups() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { items: { id: string; order: number }[] },
    { previous: HabitGroup[] | undefined }
  >({
    mutationFn: (data) => habitsApi.reorderGroups(data),
    // Optimistically apply the new order so a dropped group holds its position
    // instead of snapping back to the pre-drag order until the refetch lands.
    onMutate: async ({ items }) => {
      await qc.cancelQueries({ queryKey: habitGroupKeys.all });
      const previous = qc.getQueryData<HabitGroup[]>(habitGroupKeys.all);
      if (Array.isArray(previous)) {
        const orderById = new Map(items.map((i) => [i.id, i.order]));
        qc.setQueryData<HabitGroup[]>(
          habitGroupKeys.all,
          previous
            .map((g) =>
              orderById.has(g.id) ? { ...g, order: orderById.get(g.id)! } : g,
            )
            .sort((a, b) => a.order - b.order),
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(habitGroupKeys.all, ctx.previous);
    },
    // No settle-refetch: the optimistic order already matches the server's.
  });
}
