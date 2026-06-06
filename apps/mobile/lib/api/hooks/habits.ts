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

/**
 * Recover gracefully when a POST to /habits/:id/entries races another
 * client and lands on an active entry the API refuses to overwrite (409).
 * We refetch entries so the next render's smart handlers will PATCH the
 * fresh entry instead, and we surface a single human-readable error.
 *
 * Returns true if the error WAS a 409 (caller should suppress its own
 * generic error toast in favor of the more accurate "refreshed" message).
 */
function isAxios409(err: unknown): boolean {
  // axios attaches `response.status`; keep the shape check loose so this
  // works whether axios, fetch, or a test mock surfaces the error.
  const e = err as { response?: { status?: number }; status?: number };
  return e?.response?.status === 409 || e?.status === 409;
}

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

/**
 * Edit-only fields. Superset of `CreateHabitInput`: adds `weeklyTarget`
 * (times-per-week target) and lets `scheduledDays` be `null` to WIPE a
 * previously-set schedule — the form emits `undefined` for "no specific
 * days", so the edit host translates that to `null`. Mirrors the PWA's
 * useUpdateHabit data shape (apps/pwa/src/lib/api/habits.ts).
 */
export type UpdateHabitInput = Partial<
  Omit<CreateHabitInput, "scheduledDays">
> & {
  scheduledDays?: number[] | null;
  weeklyTarget?: number;
};

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateHabitInput;
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
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev);
      // 409 = another client raced us and created an entry first. Force a
      // refetch so the next render's smart handlers PATCH the live entry.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

/**
 * Optimistic insert of a value-0 entry of the given type. Used by skip + fail
 * so the UI flips instantly. Returns the rollback context for onError.
 */
function optimisticInsertNonCompletion(
  qc: ReturnType<typeof useQueryClient>,
  habitId: string,
  date: string | undefined,
  type: "skip" | "fail",
  skipReason?: string,
) {
  const key = habitKeys.entries(habitId);
  const d = date ?? new Date().toISOString().slice(0, 10);
  const prev = qc.getQueryData<HabitEntry[]>(key);
  const existing = prev?.find((e) => e.date === d);
  const next: HabitEntry[] = existing
    ? prev!.map((e) =>
        e.date === d ? ({ ...e, type, value: 0, skipReason } as HabitEntry) : e,
      )
    : [
        ...(prev ?? []),
        {
          id: `optimistic-${type}-${d}`,
          habitId,
          userSub: "",
          date: d,
          value: 0,
          type,
          skipReason,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as HabitEntry,
      ];
  qc.setQueryData<HabitEntry[]>(key, next);
  return { prev, key };
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
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: habitKeys.entries(input.habitId) });
      return optimisticInsertNonCompletion(
        qc,
        input.habitId,
        input.date,
        "skip",
        input.reason,
      );
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev);
      // 409 = race with another client. Refetch so the next attempt sees
      // the live entry and PATCHes it instead of POSTing again.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

/**
 * Mark a date as failed — user explicitly admitting a miss. Breaks the
 * streak immediately. Distinct from skip (which preserves the streak) and
 * from leaving the day open (which doesn't break until day-rollover).
 */
export function useFailHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { habitId: string; date?: string }) => {
      const { data } = await apiClient.post<HabitEntry>(
        `/habits/${input.habitId}/entries`,
        { date: input.date, value: 0, type: "fail" },
      );
      return data;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: habitKeys.entries(input.habitId) });
      return optimisticInsertNonCompletion(
        qc,
        input.habitId,
        input.date,
        "fail",
      );
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev);
      // 409 = race with another client. Refetch so the next attempt sees
      // the live entry and PATCHes it instead of POSTing again.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

/**
 * Update an existing entry (used by Undo — PATCH value -= 1). Matches
 * the PWA's handleUndo path in components/habits/habit-card.tsx:147 so
 * deleting an entry only happens when the user explicitly removes it
 * via the detail screen, not via Undo on the card.
 */
export type UpdateHabitEntryInput = {
  habitId: string;
  entryId: string;
  patch: Partial<Pick<HabitEntry, "value" | "type" | "notes" | "skipReason">>;
};

export function useUpdateHabitEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, entryId, patch }: UpdateHabitEntryInput) => {
      const { data } = await apiClient.patch<HabitEntry>(
        `/habits/${habitId}/entries/${entryId}`,
        patch,
      );
      return data;
    },
    onMutate: async ({ habitId, entryId, patch }) => {
      const key = habitKeys.entries(habitId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<HabitEntry[]>(key);
      if (prev) {
        qc.setQueryData<HabitEntry[]>(
          key,
          prev.map((e) =>
            e.id === entryId ? ({ ...e, ...patch } as HabitEntry) : e,
          ),
        );
      }
      return { prev, key };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev);
      // 409 = race with another client. Refetch so the next attempt sees
      // the live entry and PATCHes it instead of POSTing again.
      if (isAxios409(err)) {
        qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      }
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

/**
 * Hard-delete an entry. NOT used by HabitCard / detail-screen day actions —
 * those PATCH instead of DELETE because the Mongo (userSub, habit_id, date)
 * unique index doesn't filter soft-deleted rows, so a delete+create cycle
 * E11000s on the next POST. This hook is retained for an explicit "remove
 * this entry from history" affordance (e.g. a future "delete from recent
 * entries" gesture). If you reach for it in a Skip/Fail/Undo flow, you
 * almost certainly want useUpdateHabitEntry instead.
 */
export function useDeleteHabitEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habitId,
      entryId,
    }: {
      habitId: string;
      entryId: string;
    }) => {
      await apiClient.delete(`/habits/${habitId}/entries/${entryId}`);
      return { habitId, entryId };
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: habitKeys.entries(vars.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}
