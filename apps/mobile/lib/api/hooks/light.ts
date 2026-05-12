// apps/mobile/lib/api/hooks/light.ts
//
// Hooks for the /light/* endpoints. Mirrors what PWA exposes via
// apps/pwa/lib/api/light.ts and powers:
//
//   - Targets settings in Profile (todoTargetDaily, journalTargetDailyWords)
//   - Today dashboard's light tier display + LevelUpCelebration overlay
//   - Per-surface ring streaks (perfectDayStreak, todoRingStreak, etc.)
//
// See packages/core/src/types/light.ts for the UserLight shape.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LightStats, UserLight } from "@repo/core/types";

import { apiClient } from "../client";

export const lightKeys = {
  all: ["light"] as const,
  me: () => [...lightKeys.all, "me"] as const,
  stats: (today?: boolean) => [...lightKeys.all, "stats", { today }] as const,
};

export function useUserLight() {
  return useQuery({
    queryKey: lightKeys.me(),
    queryFn: async () => {
      const { data } = await apiClient.get<UserLight>("/light/me");
      return data;
    },
    // Keep this cached longer than the per-surface lists — tier + targets
    // change rarely (the streak fields update via invalidate on mutations).
    staleTime: 30_000,
  });
}

export function useLightStats(today = false) {
  return useQuery({
    queryKey: lightKeys.stats(today),
    queryFn: async () => {
      const { data } = await apiClient.get<LightStats>("/light/stats", {
        params: { today: today ? true : undefined },
      });
      return data;
    },
  });
}

export type UpdateTargetsInput = {
  todoTargetDaily?: number;
  journalTargetDailyWords?: number;
};

export function useUpdateTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTargetsInput) => {
      const { data } = await apiClient.patch<UserLight>(
        "/light/targets",
        input,
      );
      return data;
    },
    onSuccess: (data) => {
      // Server-authoritative; replace the cached UserLight directly so
      // the rest of the app sees the new targets immediately.
      qc.setQueryData(lightKeys.me(), data);
    },
  });
}
