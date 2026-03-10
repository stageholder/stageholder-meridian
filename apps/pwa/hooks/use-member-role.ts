"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { WorkspaceMember } from "@repo/core/types";

export function useMemberRole(workspaceId: string) {
  const user = useAuthStore((s) => s.user);

  const { data: members } = useQuery<WorkspaceMember[]>({
    queryKey: ["workspaceMembers", workspaceId],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspaceId}/members`);
      return res.data?.data ?? res.data;
    },
    enabled: !!workspaceId && !!user,
  });

  if (!members || !user) return null;
  const me = members.find((m) => m.userId === user.id);
  return me?.role ?? null;
}
