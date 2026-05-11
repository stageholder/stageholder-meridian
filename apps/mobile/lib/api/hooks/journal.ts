// apps/mobile/lib/api/hooks/journal.ts
//
// React Query hooks for /journals. Aligned with @repo/core/types — fields
// are `title`, `content`, `date` (yyyy-mm-dd), `wordCount` (server-computed),
// `tags` (string[] or comma-string per server normalization).
//
// EntryEditor autosave hammers useUpdateJournal — onSettled invalidates
// lazily so we don't thrash the network on every keystroke.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Journal, JournalStats } from "@repo/core/types";

import { apiClient } from "../client";
import { journalKeys } from "../keys";

/* ------------------------------ Reads -------------------------------- */

export function useJournals(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: journalKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Journal[] } | Journal[]>(
        "/journals",
        { params: filters },
      );
      return Array.isArray(data) ? data : data.data;
    },
  });
}

export function useJournal(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? journalKeys.detail(id) : journalKeys.detail("disabled"),
    queryFn: async () => {
      const { data } = await apiClient.get<Journal>(`/journals/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useJournalStats(today?: boolean) {
  return useQuery({
    queryKey: [...journalKeys.stats(), { today }] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<JournalStats>("/journals/stats", {
        params: { today: today ? true : undefined },
      });
      return data;
    },
  });
}

/* ---------------------------- Mutations ------------------------------ */

export type CreateJournalInput = {
  title?: string;
  content: string;
  mood?: number;
  tags?: string[];
  /** yyyy-mm-dd. Server uses today when omitted. */
  date?: string;
};

export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateJournalInput) => {
      const { data } = await apiClient.post<Journal>("/journals", {
        title: "",
        ...input,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: journalKeys.lists() }),
  });
}

export type UpdateJournalInput = Partial<CreateJournalInput>;

export function useUpdateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateJournalInput;
    }) => {
      const { data } = await apiClient.patch<Journal>(`/journals/${id}`, patch);
      return data;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: journalKeys.lists() });
      const snapshots = qc.getQueriesData<Journal[]>({
        queryKey: journalKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Journal[]>(
          key,
          prev.map((j) =>
            j.id === id
              ? { ...j, ...patch, updatedAt: new Date().toISOString() }
              : j,
          ),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: journalKeys.lists() });
      if (vars) qc.invalidateQueries({ queryKey: journalKeys.detail(vars.id) });
    },
  });
}

export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/journals/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: journalKeys.lists() });
      const snapshots = qc.getQueriesData<Journal[]>({
        queryKey: journalKeys.lists(),
      });
      for (const [key, prev] of snapshots) {
        if (!prev) continue;
        qc.setQueryData<Journal[]>(
          key,
          prev.filter((j) => j.id !== id),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.lists() }),
  });
}
