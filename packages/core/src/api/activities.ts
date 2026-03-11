import type { AxiosInstance } from "axios";
import type { Activity } from "@repo/core/types";
import { workspacePath } from "./client";

export function createActivitiesApi(
  client: AxiosInstance,
  getWorkspaceId: () => string,
) {
  const wp = (path: string) => workspacePath(getWorkspaceId(), path);

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
      const res = await client.get(wp("/activities"), { params });
      return res.data;
    },
  };
}

export type ActivitiesApi = ReturnType<typeof createActivitiesApi>;
