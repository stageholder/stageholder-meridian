// apps/mobile/lib/api/hooks/habits.ts
//
// React Query hooks for /habits and /habits/:id/entries.
// Field names align with @repo/core/types — habit has `name` (not title),
// `targetCount` (not target), `frequency`, no inline checkIns. Per-day
// state lives in HabitEntry rows fetched via useHabitEntries.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Habit, HabitEntry } from "@repo/core/types";

import { apiClient } from "../client";
import { habitKeys } from "../keys";

/* ------------------------------ Reads -------------------------------- */

export function useHabits() {
  return useQuery({
    queryKey: habitKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Habit[] } | Habit[]>(
        "/habits",
      );
      return Array.isArray(data) ? data : data.data;
    },
  });
}

export function useHabit(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? habitKeys.detail(id) : habitKeys.detail("disabled"),
    queryFn: async () => {
      const { data } = await apiClient.get<Habit>(`/habits/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useHabitEntries(habitId: string | null | undefined) {
  return useQuery({
    queryKey: habitId
      ? habitKeys.entries(habitId)
      : habitKeys.entries("disabled"),
    queryFn: async () => {
      const { data } = await apiClient.get<
        { data: HabitEntry[] } | HabitEntry[]
      >(`/habits/${habitId}/entries`);
      return Array.isArray(data) ? data : data.data;
    },
    enabled: !!habitId,
  });
}

/* ---------------------------- Mutations ------------------------------ */

export type CreateHabitInput = {
  name: string;
  description?: string;
  frequency?: Habit["frequency"];
  targetCount?: number;
  scheduledDays?: number[];
  unit?: string;
  color?: string;
  icon?: string;
};

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateHabitInput) => {
      const { data } = await apiClient.post<Habit>("/habits", {
        frequency: "daily",
        targetCount: 1,
        ...input,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.lists() }),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<CreateHabitInput>;
    }) => {
      const { data } = await apiClient.patch<Habit>(`/habits/${id}`, patch);
      return data;
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
      if (vars) qc.invalidateQueries({ queryKey: habitKeys.detail(vars.id) });
    },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/habits/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: habitKeys.lists() });
      const snapshots = qc.getQueriesData<Habit[]>({
        queryKey: habitKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Habit[]>(
          key,
          prev.filter((h) => h.id !== id),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: habitKeys.lists() }),
  });
}

/* -------------------------- Check-in ------------------------- */

export type CheckInInput = {
  habitId: string;
  /** yyyy-mm-dd. Defaults to today on the server. */
  date?: string;
  /** Increment by this amount. Defaults to 1. */
  value?: number;
};

/**
 * Check in (create-or-update today's entry). Optimistic: bumps the entry
 * cache so HabitCard's "checked today" state flips instantly. The server
 * is the source of truth for streak math + value normalization.
 */
export function useCheckInHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckInInput) => {
      const { data } = await apiClient.post<HabitEntry>(
        `/habits/${input.habitId}/entries`,
        { date: input.date, value: input.value ?? 1, type: "completion" },
      );
      return data;
    },
    onMutate: async (input) => {
      const key = habitKeys.entries(input.habitId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<HabitEntry[]>(key);
      const today = input.date ?? new Date().toISOString().slice(0, 10);
      const existing = prev?.find((e) => e.date === today);
      // Optimistic: insert/update today's entry inline.
      const next: HabitEntry[] = existing
        ? prev!.map((e) =>
            e.date === today
              ? { ...e, value: (e.value ?? 0) + (input.value ?? 1) }
              : e,
          )
        : [
            ...(prev ?? []),
            {
              id: `optimistic-${today}`,
              habitId: input.habitId,
              userSub: "",
              date: today,
              value: input.value ?? 1,
              type: "completion" as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
      qc.setQueryData<HabitEntry[]>(key, next);
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

/** Mark a date as skipped (off-day, doesn't break streak). */
export function useSkipHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      habitId: string;
      date?: string;
      reason?: string;
    }) => {
      const { data } = await apiClient.post<HabitEntry>(
        `/habits/${input.habitId}/entries`,
        { date: input.date, value: 0, type: "skip", skipReason: input.reason },
      );
      return data;
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}
