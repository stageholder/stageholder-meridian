import {
  useQueryClient,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { Journal, JournalStats } from "@repo/core/types";
import {
  useOfflineQuerySingle,
  useOfflineQueryFiltered,
  useOfflineMutation,
  useOfflineDeleteMutation,
} from "@repo/offline/hooks";
import { db } from "@repo/offline/db";
import {
  getCurrentUserSub,
  tryGetCurrentUserSub,
} from "@/lib/current-user-sub";
import { lightKeys } from "./light";
import { todayLocal } from "@/lib/date";
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

export const journalKeys = {
  all: ["journals"] as const,
  stats: ["journals", "stats"] as const,
};

export function useJournalStats() {
  return useQuery<JournalStats>({
    queryKey: journalKeys.stats,
    queryFn: async () => {
      const today = todayLocal();
      const res = await apiClient.get(`/journals/stats`, { params: { today } });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useJournals(
  params?: { startDate?: string; endDate?: string },
  options?: { enabled?: boolean },
) {
  const localQueryFn = useCallback(() => {
    if (params?.startDate && params?.endDate) {
      return db.journals
        .where("date")
        .between(params.startDate, params.endDate, true, true)
        .toArray();
    }
    return db.journals.toArray();
  }, [params?.startDate, params?.endDate]);

  const dek = useEncryptionStore((s) => s.dek);
  const isSetup = useEncryptionStore((s) => s.isSetup);
  const isLocked = isSetup && !dek;

  return useOfflineQueryFiltered<Journal>(
    ["journals", params],
    localQueryFn,
    async () => {
      const res = await apiClient.get(`/journals`, { params });
      const journals: Journal[] = res.data?.data ?? res.data;
      if (dek) return decryptJournalList(journals, dek);
      return journals;
    },
    db.journals,
    { enabled: options?.enabled !== false && !isLocked },
  );
}

export function useJournalsPaginated(limit = 20) {
  const dek = useEncryptionStore((s) => s.dek);

  return useInfiniteQuery<PaginatedResponse>({
    queryKey: ["journals", "paginated"],
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get(`/journals`, {
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
  const dek = useEncryptionStore((s) => s.dek);
  const isSetup = useEncryptionStore((s) => s.isSetup);
  const isLocked = isSetup && !dek;

  return useOfflineQuerySingle<Journal>(
    ["journal", id],
    db.journals,
    id,
    async () => {
      const res = await apiClient.get(`/journals/${id}`);
      const journal: Journal = res.data;
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    { enabled: !!id && !isLocked },
  );
}

export function useCreateJournal() {
  const queryClient = useQueryClient();
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
      const res = await apiClient.post(`/journals`, payload);
      const journal: Journal = res.data;
      // Decrypt response before it's stored in Dexie
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    table: db.journals,
    entityType: "journals",
    operation: "create",
    buildPath: () => `/journals`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [
      ["journals"],
      [...lightKeys.me],
      [...lightKeys.stats],
      ["calendar"],
      [...journalKeys.stats],
    ],
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["journals"] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals"],
        exact: false,
      });

      const optimisticJournal: Journal = {
        id: `temp-${Date.now()}`,
        userSub: tryGetCurrentUserSub() ?? "",
        authorId: "",
        title: newData.title,
        content: newData.content,
        mood: newData.mood,
        tags: newData.tags ?? [],
        date: newData.date ?? todayLocal(),
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
      void queryClient.invalidateQueries({ queryKey: ["journals"] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
      void queryClient.invalidateQueries({ queryKey: lightKeys.stats });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdateJournal() {
  const queryClient = useQueryClient();
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
      const res = await apiClient.patch(`/journals/${id}`, payload);
      const journal: Journal = res.data;
      // Decrypt response before it's stored in Dexie
      if (dek) return decryptJournalResponse(journal, dek);
      return journal;
    },
    table: db.journals,
    entityType: "journals",
    operation: "update",
    buildPath: ({ id }) => `/journals/${id}`,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["journals"], ["calendar"], [...journalKeys.stats]],
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["journals"] });
      await queryClient.cancelQueries({ queryKey: ["journal", id] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals"],
        exact: false,
      });

      const previousDetail = queryClient.getQueryData<Journal>(["journal", id]);

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

      queryClient.setQueryData<Journal>(["journal", id], (old) =>
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
          ["journal", variables.id],
          context.previousDetail,
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSettled: ((_data: any, _err: any, variables: any) => {
      void queryClient.invalidateQueries({ queryKey: ["journals"] });
      void queryClient.invalidateQueries({
        queryKey: ["journal", variables.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  });
}

export function useDeleteJournal() {
  const queryClient = useQueryClient();

  return useOfflineDeleteMutation<string>({
    mutationFn: async (id) => {
      await apiClient.delete(`/journals/${id}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: db.journals as any,
    entityType: "journals",
    buildPath: (id) => `/journals/${id}`,
    getEntityId: (id) => id,
    getUserSub: getCurrentUserSub,
    invalidateKeys: [["journals"], ["calendar"], [...journalKeys.stats]],
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["journals"] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals"],
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
      void queryClient.invalidateQueries({ queryKey: ["journals"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
