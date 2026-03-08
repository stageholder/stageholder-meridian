import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { Journal } from "@repo/core/types";
import { lightKeys } from "./light";

interface PaginatedResponse {
  data: Journal[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useJournals(params?: { startDate?: string; endDate?: string }, options?: { enabled?: boolean }) {
  const { workspace } = useWorkspace();

  return useQuery<Journal[]>({
    queryKey: ["journals", workspace.id, params],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/journals`, { params });
      return res.data?.data ?? res.data;
    },
    enabled: options?.enabled,
  });
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

  return useQuery<Journal>({
    queryKey: ["journal", workspace.id, id],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/journals/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateJournal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      mood?: number;
      tags?: string[];
      date?: string;
    }) => {
      const res = await apiClient.post(`/workspaces/${workspace.id}/journals`, data);
      return res.data as Journal;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["journals", workspace.id] });

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

      // Only update flat Journal[] caches (not paginated infinite query)
      for (const [queryKey, data] of previousQueries) {
        if (Array.isArray(data)) {
          queryClient.setQueryData<Journal[]>(queryKey, [optimisticJournal, ...data]);
        }
      }

      return { previousQueries };
    },
    onError: (_err, _data, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
      void queryClient.invalidateQueries({ queryKey: ["calendar", workspace.id] });
    },
  });
}

export function useUpdateJournal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        title?: string;
        content?: string;
        mood?: number;
        tags?: string[];
      };
    }) => {
      const res = await apiClient.patch(`/workspaces/${workspace.id}/journals/${id}`, data);
      return res.data as Journal;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["journals", workspace.id] });
      await queryClient.cancelQueries({ queryKey: ["journal", workspace.id, id] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals", workspace.id],
        exact: false,
      });

      const previousDetail = queryClient.getQueryData<Journal>(["journal", workspace.id, id]);

      for (const [queryKey, old] of previousQueries) {
        if (Array.isArray(old)) {
          queryClient.setQueryData<Journal[]>(
            queryKey,
            old.map((j) => (j.id === id ? { ...j, ...data, updatedAt: new Date().toISOString() } : j)),
          );
        }
      }

      queryClient.setQueryData<Journal>(["journal", workspace.id, id], (old) =>
        old ? { ...old, ...data, updatedAt: new Date().toISOString() } : old,
      );

      return { previousQueries, previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(["journal", workspace.id, variables.id], context.previousDetail);
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["journals", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["journal", workspace.id, variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", workspace.id] });
    },
  });
}

export function useDeleteJournal() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workspaces/${workspace.id}/journals/${id}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["journals", workspace.id] });

      const previousQueries = queryClient.getQueriesData<Journal[]>({
        queryKey: ["journals", workspace.id],
        exact: false,
      });

      for (const [queryKey, old] of previousQueries) {
        if (Array.isArray(old)) {
          queryClient.setQueryData<Journal[]>(queryKey, old.filter((j) => j.id !== id));
        }
      }

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", workspace.id] });
    },
  });
}
