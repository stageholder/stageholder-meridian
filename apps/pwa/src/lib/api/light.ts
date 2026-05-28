import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserLight, LightEvent, LightStats } from "@repo/core/types";
import { todayLocal } from "@/lib/date";
import { lightApi } from "./clients";

export const lightKeys = {
  me: ["light", "me"] as const,
  stats: ["light", "stats"] as const,
  events: (limit?: number, offset?: number) =>
    ["light", "events", { limit, offset }] as const,
};

export function useUserLight() {
  return useQuery<UserLight>({
    queryKey: lightKeys.me,
    queryFn: () => lightApi.me(),
  });
}

export function useUpdateTargets() {
  const queryClient = useQueryClient();
  return useMutation<
    UserLight,
    Error,
    { todoTargetDaily?: number; journalTargetDailyWords?: number }
  >({
    mutationFn: (data) => lightApi.updateTargets(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lightKeys.me });
    },
  });
}

export function useLightStats() {
  return useQuery<LightStats>({
    queryKey: lightKeys.stats,
    queryFn: () => lightApi.stats({ today: todayLocal() }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useLightEvents(limit?: number, offset?: number) {
  return useQuery<LightEvent[]>({
    queryKey: lightKeys.events(limit, offset),
    queryFn: () => lightApi.events({ limit, offset }),
  });
}
