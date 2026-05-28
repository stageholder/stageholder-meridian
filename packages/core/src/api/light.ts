import type { ApiClientLike } from "./client";
import type { UserLight, LightEvent, LightStats } from "@repo/core/types";

export function createLightApi(client: ApiClientLike) {
  return {
    me: async (): Promise<UserLight> => {
      const res = await client.get("/light/me");
      return res.data;
    },
    events: async (params?: {
      limit?: number;
      offset?: number;
    }): Promise<LightEvent[]> => {
      const res = await client.get("/light/events", { params });
      return res.data?.data ?? res.data;
    },
    /**
     * Update the user's per-day ring targets. Either field is optional —
     * unspecified fields keep their current value. Returns the refreshed
     * UserLight so the caller can update its cache in one round-trip.
     */
    updateTargets: async (data: {
      todoTargetDaily?: number;
      journalTargetDailyWords?: number;
    }): Promise<UserLight> => {
      const res = await client.patch("/light/targets", data);
      return res.data;
    },
    /**
     * Per-day light totals + an all-time baseline, used to drive the Light
     * Earned dashboard chart and the level progress UI. Pass `today` so the
     * server can compute the local boundary correctly (the API is
     * timezone-agnostic).
     */
    stats: async (params: { today: string }): Promise<LightStats> => {
      const res = await client.get("/light/stats", { params });
      return res.data;
    },
  };
}

export type LightApi = ReturnType<typeof createLightApi>;
