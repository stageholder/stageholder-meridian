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

  return useOfflineQueryFiltered<Journal>(
    ["journals", workspace.id, params],
    localQueryFn,
    async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/journals`, {
        params,
      });
      return res.data?.data ?? res.data;
    },
    db.journals,
    { enabled: options?.enabled },
  );
}

export function useJournalsPaginated(limit = 20) {
  const { workspace } = useWorkspace();

  return useInfiniteQuery<PaginatedResponse>({
    queryKey: ["journals", workspace.id, "paginated"],
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/journals`, {
        params: { page: pageParam, limit },
      });
      return res.data;
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

  return useOfflineQuerySingle<Journal>(
    ["journal", workspace.id, id],
    db.journals,
    id,
    async () => {
      const res = await apiClient.get(
        `/workspaces/${workspace.id}/journals/${id}`,
      );
      return res.data;
    },
    { enabled: !!id },
  );
}

export function useCreateJournal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

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
      const res = await apiClient.post(
        `/workspaces/${workspace.id}/journals`,
        data,
      );
      return res.data as Journal;
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

      return { previousQueries } as any;
    },
    onError: ((_err: Error, _data: any, context: any) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
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
      const res = await apiClient.patch(
        `/workspaces/${workspace.id}/journals/${id}`,
        data,
      );
      return res.data as Journal;
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

      return { previousQueries, previousDetail } as any;
    },
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
    }) as any,
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

      return { previousQueries } as any;
    },
    onError: ((_err: Error, _id: any, context: any) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
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
