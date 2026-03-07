import type { AxiosInstance } from 'axios';
import type { UserLight, LightEvent } from '@repo/core/types';

export function createLightApi(client: AxiosInstance) {
  return {
    me: async (): Promise<UserLight> => {
      const res = await client.get('/light/me');
      return res.data;
    },
    events: async (params?: { limit?: number; offset?: number }): Promise<LightEvent[]> => {
      const res = await client.get('/light/events', { params });
      return res.data?.data ?? res.data;
    },
  };
}

export type LightApi = ReturnType<typeof createLightApi>;
