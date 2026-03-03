import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { workspacePath } from "@/lib/api-client";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Journal } from "@repo/core/types";

export function useJournals(params?: { startDate?: string; endDate?: string }) {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<Journal[]>({
    queryKey: ["journals", activeWorkspaceId, params],
    queryFn: async () => {
      const res = await apiClient.get(workspacePath("/journals"), { params });
      return res.data?.data ?? res.data;
    },
    enabled: !!activeWorkspaceId,
  });
}

export function useJournal(id: string) {
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<Journal>({
    queryKey: ["journal", activeWorkspaceId, id],
    queryFn: async () => {
      const res = await apiClient.get(workspacePath(`/journals/${id}`));
      return res.data;
    },
    enabled: !!activeWorkspaceId && !!id,
  });
}

export function useCreateJournal() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      mood?: number;
      tags?: string[];
      date?: string;
    }) => {
      const res = await apiClient.post(workspacePath("/journals"), data);
      return res.data as Journal;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals", activeWorkspaceId] });
    },
  });
}

export function useUpdateJournal() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

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
      const res = await apiClient.patch(workspacePath(`/journals/${id}`), data);
      return res.data as Journal;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["journals", activeWorkspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["journal", activeWorkspaceId, variables.id] });
    },
  });
}

export function useDeleteJournal() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(workspacePath(`/journals/${id}`));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals", activeWorkspaceId] });
    },
  });
}
