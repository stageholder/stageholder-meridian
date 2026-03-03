import type { AxiosInstance } from 'axios';
import type { Tag } from '@repo/core/types';
import { workspacePath } from './client';

export function createTagsApi(client: AxiosInstance, getWorkspaceId: () => string) {
  const wp = (path: string) => workspacePath(getWorkspaceId(), path);

  return {
    create: async (data: { name: string; color: string }): Promise<Tag> => {
      const res = await client.post(wp('/tags'), data);
      return res.data;
    },
    list: async (): Promise<Tag[]> => {
      const res = await client.get(wp('/tags'));
      return res.data;
    },
    update: async (id: string, data: { name?: string; color?: string }): Promise<Tag> => {
      const res = await client.patch(wp(`/tags/${id}`), data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(wp(`/tags/${id}`));
    },
  };
}

export type TagsApi = ReturnType<typeof createTagsApi>;
