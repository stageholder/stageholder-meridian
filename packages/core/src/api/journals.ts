import type { AxiosInstance } from "axios";
import type { Journal } from "@repo/core/types";
import { workspacePath } from "./client";

export function createJournalsApi(
  client: AxiosInstance,
  getWorkspaceId: () => string,
) {
  const wp = (path: string) => workspacePath(getWorkspaceId(), path);

  return {
    create: async (data: {
      title: string;
      content: string;
      mood?: number;
      tags?: string[];
      date?: string;
    }): Promise<Journal> => {
      const res = await client.post(wp("/journals"), data);
      return res.data;
    },
    list: async (params?: {
      startDate?: string;
      endDate?: string;
    }): Promise<Journal[]> => {
      const res = await client.get(wp("/journals"), { params });
      return res.data?.data ?? res.data;
    },
    get: async (id: string): Promise<Journal> => {
      const res = await client.get(wp(`/journals/${id}`));
      return res.data;
    },
    update: async (
      id: string,
      data: {
        title?: string;
        content?: string;
        mood?: number;
        tags?: string[];
      },
    ): Promise<Journal> => {
      const res = await client.patch(wp(`/journals/${id}`), data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(wp(`/journals/${id}`));
    },
  };
}

export type JournalsApi = ReturnType<typeof createJournalsApi>;
