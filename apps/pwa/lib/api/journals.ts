import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { Journal } from "@repo/core/types";
import {
  useOfflineQuerySingle,
  useOfflineQueryFiltered,
  useOfflineMutation,
  useOfflineDeleteMutation,
} from "@repo/offline/hooks";
import { db } from "@repo/offline/db";
import { lightKeys } from "./light";
import { useCallback } from "react";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import {
  encryptJournalPayload,
  decryptJournalResponse,
  decryptJournalList,
} from "@/lib/crypto/journal-crypto";

interface PaginatedResponse {
  data: Journal[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useJournals(
  params?: { startDate?: string; endDate?: string },
  options?: { enabled?: boolean },
) {
  const { workspace } = useWorkspace();

  const localQueryFn = useCallback(() => {
    if (params?.startDate && params?.endDate) {
      return db.journals
        .where("date")
        .between(params.startDate, params.endDate, true, true)
        .toArray();
    }
    return db.journals.where("workspaceId").equals(workspace.id).toArray();
  }, [workspace.id, params?.startDate, params?.endDate]);

  const dek = useEncryptionStore((s) => s.dek);
  const isSetup = useEncryptionStore((s) => s.isSetup);
  const isLocked = isSetup && !dek;

  return useOfflineQueryFiltered<Journal>(
    ["journals", workspace.id, params],
    localQueryFn,
    async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/journals`, {
        params,
      });
      const journals: Journal[] = res.data?.data ?? res.data;
      if (dek) return decryptJournalList(journals, dek);
      return journals;
    },
    db.journals,
    { enabled: options?.enabled !== false && !isLocked },
  );
}

export function useJournalsPaginated(limit = 20) {
  const { workspace } = useWorkspace();
  const dek = useEncryptionStore((s) => s.dek);

  return useInfiniteQuery<PaginatedResponse>({
    queryKey: ["journals", workspace.id, "paginated"],
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/journals`, {
        params: { page: pageParam, limit },
      });
      const page = res.data as PaginatedResponse;
      if (dek) {
        page.data = await decryptJournalList(page.data, dek);
      }
      return page;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
  });
}

export function useJournal(id: string) {
  const { workspace } = useWorkspace();
  const dek = useEncryptionStore((s) => s.dek);
  const isSetup = useEncryptionStore((s) => s.isSetup);
  const isLocked = isSetup && !dek;

  return useOfflineQuerySingle<Journal>(
    ["journal", workspace.id, id],
    db.journals,
    id,
    async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/journals/${id}`,
      );
      const journal: Journal = res.data;
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    { enabled: !!id && !isLocked },
  );
}

export function useCreateJournal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const dek = useEncryptionStore((s) => s.dek);

  return useOfflineMutation<
    Journal,
    {
      title: string;
      content: string;
      mood?: number;
      tags?: string[];
      date?: string;
    }
  >({
    mutationFn: async (data) => {
      const payload = dek ? await encryptJournalPayload(data, dek) : data;
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/journals`,
        payload,
      );
      const journal: Journal = res.data;
      // Decrypt response before it's stored in Dexie
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    table: db.journals,
    entityType: "journals",
    operation: "create",
    buildPath: () => `/workspaces/${workspace.id}/journals`,
    invalidateKeys: [
      ["journals", workspace.id],
      [...lightKeys.me],
      ["calendar", workspace.id],
    ],
    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: ["journals", workspace.id],
      });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals", workspace.id],
        exact: false,
      });

      const optimisticJournal: Journal = {
        id: `temp-${Date.now()}`,
        workspaceId: workspace.id,
        authorId: "",
        title: newData.title,
        content: newData.content,
        mood: newData.mood,
        tags: newData.tags ?? [],
        date: newData.date ?? new Date().toISOString().slice(0, 10),
        wordCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      for (const [queryKey, data] of previousQueries) {
        if (Array.isArray(data)) {
          queryClient.setQueryData<Journal[]>(queryKey, [
            optimisticJournal,
            ...data,
          ]);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { previousQueries } as any;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: ((_err: Error, _data: any, context: any) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["journals", workspace.id],
      });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspace.id],
      });
    },
  });
}

export function useUpdateJournal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const dek = useEncryptionStore((s) => s.dek);

  return useOfflineMutation<
    Journal,
    {
      id: string;
      data: {
        title?: string;
        content?: string;
        mood?: number;
        tags?: string[];
      };
    }
  >({
    mutationFn: async ({ id, data }) => {
      const payload = dek
        ? await encryptJournalPayload(
            {
              title: data.title || "",
              content: data.content || "",
              tags: data.tags,
              mood: data.mood,
            },
            dek,
          )
        : data;
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/journals/${id}`,
        payload,
      );
      const journal: Journal = res.data;
      // Decrypt response before it's stored in Dexie
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    table: db.journals,
    entityType: "journals",
    operation: "update",
    buildPath: ({ id }) => `/workspaces/${workspace.id}/journals/${id}`,
    invalidateKeys: [
      ["journals", workspace.id],
      ["calendar", workspace.id],
    ],
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["journals", workspace.id],
      });
      await queryClient.cancelQueries({
        queryKey: ["journal", workspace.id, id],
      });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals", workspace.id],
        exact: false,
      });

      const previousDetail = queryClient.getQueryData<Journal>([
        "journal",
        workspace.id,
        id,
      ]);

      for (const [queryKey, old] of previousQueries) {
        if (Array.isArray(old)) {
          queryClient.setQueryData<Journal[]>(
            queryKey,
            old.map((j) =>
              j.id === id
                ? { ...j, ...data, updatedAt: new Date().toISOString() }
                : j,
            ),
          );
        }
      }

      queryClient.setQueryData<Journal>(["journal", workspace.id, id], (old) =>
        old ? { ...old, ...data, updatedAt: new Date().toISOString() } : old,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { previousQueries, previousDetail } as any;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: ((_err: Error, variables: any, context: any) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          ["journal", workspace.id, variables.id],
          context.previousDetail,
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSettled: ((_data: any, _err: any, variables: any) => {
      void queryClient.invalidateQueries({
        queryKey: ["journals", workspace.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["journal", workspace.id, variables.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspace.id],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  });
}

export function useDeleteJournal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useOfflineDeleteMutation<string>({
    mutationFn: async (id) => {
      await apiClient.delete(`/workspaces/${workspace.id}/journals/${id}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: db.journals as any,
    entityType: "journals",
    buildPath: (id) => `/workspaces/${workspace.id}/journals/${id}`,
    getEntityId: (id) => id,
    invalidateKeys: [
      ["journals", workspace.id],
      ["calendar", workspace.id],
    ],
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ["journals", workspace.id],
      });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals", workspace.id],
        exact: false,
      });

      for (const [queryKey, old] of previousQueries) {
        if (Array.isArray(old)) {
          queryClient.setQueryData<Journal[]>(
            queryKey,
            old.filter((j) => j.id !== id),
          );
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { previousQueries } as any;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: ((_err: Error, _id: any, context: any) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["journals", workspace.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["calendar", workspace.id],
      });
    },
  });
}
