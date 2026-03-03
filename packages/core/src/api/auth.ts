import type { AxiosInstance } from 'axios';
import type { AuthUser } from '@repo/core/types';

export function createAuthApi(client: AxiosInstance) {
  return {
    register: async (data: { email: string; name: string; password: string }): Promise<AuthUser> => {
      const res = await client.post('/auth/register', data);
      return res.data;
    },
    login: async (data: { email: string; password: string }): Promise<AuthUser> => {
      const res = await client.post('/auth/login', data);
      return res.data;
    },
    socialLogin: async (data: { provider: string; idToken: string }): Promise<AuthUser> => {
      const res = await client.post('/auth/social', data);
      return res.data;
    },
    refresh: async (): Promise<AuthUser> => {
      const res = await client.post('/auth/refresh');
      return res.data;
    },
    logout: async (): Promise<void> => {
      await client.post('/auth/logout');
    },
    me: async (): Promise<AuthUser> => {
      const res = await client.get('/auth/me');
      return res.data;
    },
    updateProfile: async (data: { name?: string; avatar?: string; timezone?: string }): Promise<AuthUser> => {
      const res = await client.patch('/auth/me', data);
      return res.data;
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
