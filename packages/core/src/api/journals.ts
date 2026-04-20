import type { AxiosInstance } from "axios";
import type { Journal } from "@repo/core/types";

/**
 * Journals API client. Routes are rooted at `/journals` — the Hub-integrated
 * API scopes everything off the authenticated `sub` server-side, so there is
 * no longer a workspace prefix.
 */
export function createJournalsApi(client: AxiosInstance) {
  return {
    create: async (data: {
      title: string;
      content: string;
      mood?: number;
      tags?: string[];
      date?: string;
    }): Promise<Journal> => {
      const res = await client.post(`/journals`, data);
      return res.data;
    },
    list: async (
      params?: Record<string, string | undefined>,
    ): Promise<Journal[]> => {
      const res = await client.get(`/journals`, { params });
      return res.data?.data ?? res.data;
    },
    get: async (id: string): Promise<Journal> => {
      const res = await client.get(`/journals/${id}`);
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
      const res = await client.patch(`/journals/${id}`, data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(`/journals/${id}`);
    },
  };
}

export type JournalsApi = ReturnType<typeof createJournalsApi>;
