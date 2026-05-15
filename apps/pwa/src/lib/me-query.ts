import { useQuery } from "@tanstack/react-query";
import { useUser } from "@stageholder/sdk/spa";
import { apiClient } from "@/lib/api-client";

export interface MeridianUserMeta {
  personalOrgId: string;
  hasCompletedOnboarding: boolean;
}

/**
 * Replaces the BFF `/api/me` route. Calls the Meridian API's `/me`
 * endpoint directly (apps/api/src/modules/me/me.controller.ts) and caches
 * the response in TanStack Query — same effective behavior as the prior
 * `session.custom` Mongo-backed cache, no server hop.
 *
 * Returns `undefined` while the user isn't yet authenticated; consumers
 * should gate on `isLoading` before reading `data`.
 */
export function useMeridianUserMeta() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["meridian-user-meta", user?.sub],
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<MeridianUserMeta> => {
      const res = await apiClient.get<MeridianUserMeta>("/me");
      return res.data;
    },
  });
}
