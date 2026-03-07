import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { UserLight, LightEvent } from "@repo/core/types";

export const lightKeys = {
  me: ["light", "me"] as const,
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
