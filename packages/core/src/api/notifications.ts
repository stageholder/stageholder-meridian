import type { AxiosInstance } from 'axios';
import type { AppNotification } from '@repo/core/types';

export function createNotificationsApi(client: AxiosInstance) {
  return {
    list: async (params?: { page?: number; limit?: number }): Promise<{ data: AppNotification[]; total: number; page: number; limit: number }> => {
      const res = await client.get('/notifications', { params });
      return res.data;
    },
    unreadCount: async (): Promise<{ count: number }> => {
      const res = await client.get('/notifications/unread-count');
      return res.data;
    },
    markAllRead: async (): Promise<void> => {
      await client.post('/notifications/mark-all-read');
    },
  };
}

export type NotificationsApi = ReturnType<typeof createNotificationsApi>;
