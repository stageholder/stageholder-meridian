import type { AxiosInstance } from "axios";
import type { Tag } from "@repo/core/types";

/**
 * Tags API client. Routes are rooted at `/tags` — scoping is per
 * authenticated user server-side.
 */
export function createTagsApi(client: AxiosInstance) {
  return {
    create: async (data: { name: string; color: string }): Promise<Tag> => {
      const res = await client.post(`/tags`, data);
      return res.data;
    },
    list: async (params?: Record<string, string>): Promise<Tag[]> => {
      const res = await client.get(`/tags`, { params });
      return res.data?.data ?? res.data;
    },
    update: async (
      id: string,
      data: { name?: string; color?: string },
    ): Promise<Tag> => {
      const res = await client.patch(`/tags/${id}`, data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(`/tags/${id}`);
    },
  };
}

export type TagsApi = ReturnType<typeof createTagsApi>;
