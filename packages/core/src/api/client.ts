import axios, { type AxiosInstance } from 'axios';
import type { PlatformConfig } from '@repo/core/platform';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach((promise) => {
    if (error) promise.reject(error);
    else promise.resolve();
  });
  failedQueue = [];
}

export function createApiClient(config: PlatformConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: config.authStrategy === 'cookie',
  });

  if (config.authStrategy === 'bearer') {
    client.interceptors.request.use(async (reqConfig) => {
      const token = await config.storage.getItem('access_token');
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
      reqConfig.headers['X-Auth-Strategy'] = 'bearer';
      return reqConfig;
    });

    // Store tokens from auth responses (login, register, social)
    client.interceptors.response.use(async (response) => {
      const url = response.config.url || '';
      const isAuthEndpoint = /\/auth\/(login|register|social)$/.test(url);
      if (isAuthEndpoint && response.data?.accessToken) {
        await config.storage.setItem('access_token', response.data.accessToken);
        await config.storage.setItem('refresh_token', response.data.refreshToken);
      }
      return response;
    });
  }

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/')
      ) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(() => client(originalRequest));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          if (config.authStrategy === 'bearer') {
            const refreshToken = await config.storage.getItem('refresh_token');
            if (refreshToken) {
              const res = await client.post('/auth/refresh', { refreshToken });
              await config.storage.setItem('access_token', res.data.accessToken);
              if (res.data.refreshToken) {
                await config.storage.setItem('refresh_token', res.data.refreshToken);
              }
            }
          } else {
            await client.post('/auth/refresh');
          }

          processQueue(null);
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError);
          config.onLogout?.();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export function workspacePath(workspaceId: string, path: string): string {
  return `/workspaces/${workspaceId}${path}`;
}
