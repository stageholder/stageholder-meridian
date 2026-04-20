import type { AxiosInstance } from "axios";
import type { Activity } from "@repo/core/types";

/**
 * Activities API client. Routes are rooted at `/activities` — scoping
 * is per authenticated user server-side.
 */
export function createActivitiesApi(client: AxiosInstance) {
  return {
    list: async (params?: {
      page?: number;
      limit?: number;
    }): Promise<{
      data: Activity[];
      total: number;
      page: number;
      limit: number;
    }> => {
      const res = await client.get(`/activities`, { params });
      return res.data;
    },
  };
}

export type ActivitiesApi = ReturnType<typeof createActivitiesApi>;
