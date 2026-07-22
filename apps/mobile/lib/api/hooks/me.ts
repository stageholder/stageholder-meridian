// apps/mobile/lib/api/hooks/me.ts
//
// The Meridian API's own user record (/me) — distinct from the Stageholder Hub
// profile the SDK exposes. Its `hasCompletedOnboarding` is the SERVER source of
// truth for the onboarding gate, so a user who onboarded on the PWA (or another
// device) isn't shown the wizard again on mobile. Mobile previously tracked
// completion only in expo-secure-store (device-local); this bridges to the same
// server contract the PWA already uses (GET /me + POST /me/onboarding/complete).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../client";

/** The Meridian /me payload (subset we consume). */
export interface MeridianMe {
  sub: string;
  email?: string;
  hasCompletedOnboarding: boolean;
}

export const meKeys = {
  me: ["meridian-me"] as const,
};

/** GET /me — the server user record. `enabled` gates it on having an identity. */
export function useMeridianMe(enabled = true) {
  return useQuery({
    queryKey: meKeys.me,
    queryFn: async () => {
      const { data } = await apiClient.get<MeridianMe>("/me");
      return data;
    },
    enabled,
    // The onboarding flag rarely changes; a short cache avoids re-fetching /me
    // on every authed-root remount while still catching a cross-device change.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * POST /me/onboarding/complete — flips the server `hasCompletedOnboarding`
 * flag (idempotent, no body). Writes the response into the /me cache so the
 * gate sees the change immediately without a refetch.
 */
export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<MeridianMe>(
        "/me/onboarding/complete",
        {},
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(meKeys.me, data);
    },
  });
}
