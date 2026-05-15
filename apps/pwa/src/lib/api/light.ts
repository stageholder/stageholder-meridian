import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { UserLight, LightEvent, LightStats } from "@repo/core/types";
import { todayLocal } from "@/lib/date";

export const lightKeys = {
  me: ["light", "me"] as const,
  stats: ["light", "stats"] as const,
  events: (limit?: number, offset?: number) =>
    ["light", "events", { limit, offset }] as const,
};

export function useUserLight() {
  return useQuery<UserLight>({
    queryKey: lightKeys.me,
    queryFn: async () => {
      const res = await apiClient.get("/light/me");
      return res.data;
    },
  });
}

export function useUpdateTargets() {
  const queryClient = useQueryClient();
  return useMutation<
    UserLight,
    Error,
    { todoTargetDaily?: number; journalTargetDailyWords?: number }
  >({
    mutationFn: async (data) => {
      const res = await apiClient.patch("/light/targets", data);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
    },
  });
}

export function useLightStats() {
  return useQuery<LightStats>({
    queryKey: lightKeys.stats,
    queryFn: async () => {
      const today = todayLocal();
      const res = await apiClient.get("/light/stats", {
        params: { today },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useLightEvents(limit?: number, offset?: number) {
  return useQuery<LightEvent[]>({
    queryKey: lightKeys.events(limit, offset),
    queryFn: async () => {
      const res = await apiClient.get("/light/events", {
        params: { limit, offset },
      });
      return res.data?.data ?? res.data;
    },
  });
}
