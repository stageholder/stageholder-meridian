import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import type { Journal } from "@repo/core/types";
import { lightKeys } from "./light";

export function useJournals(params?: { startDate?: string; endDate?: string }) {
  const { workspace } = useWorkspace();

  return useQuery<Journal[]>({
    queryKey: ["journals", workspace.id, params],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/journals`, { params });
      return res.data?.data ?? res.data;
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
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
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["journals", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["journal", workspace.id, variables.id] });
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journals", workspace.id] });
    },
  });
}
