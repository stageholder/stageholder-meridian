import axios, { type AxiosInstance } from "axios";
import type { PlatformConfig } from "@repo/core/platform";
import { logger } from "@repo/core/platform/logger";

export interface ApiClient extends AxiosInstance {
  /** Proactive silent refresh that respects the isRefreshing guard. */
  silentRefresh: () => Promise<void>;
}

let refreshPromise: Promise<void> | null = null;

export function waitForRefresh(): Promise<void> {
  return refreshPromise ?? Promise.resolve();
}

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

export function createApiClient(config: PlatformConfig): ApiClient {
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    headers: { "Content-Type": "application/json" },
    withCredentials: config.authStrategy === "cookie",
  });

  if (config.authStrategy === "bearer") {
    client.interceptors.request.use(async (reqConfig) => {
      const token = await config.storage.getItem("access_token");
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }
      reqConfig.headers["X-Auth-Strategy"] = "bearer";
      return reqConfig;
    });

    // Store tokens from auth responses (login, register, social)
    client.interceptors.response.use(async (response) => {
      const url = response.config.url || "";
      const isAuthEndpoint = /\/auth\/(login|register|social)$/.test(url);
      if (isAuthEndpoint && response.data?.accessToken) {
        await config.storage.setItem("access_token", response.data.accessToken);
        await config.storage.setItem(
          "refresh_token",
          response.data.refreshToken,
        );
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
        !originalRequest.url?.includes("/auth/")
      ) {
        // Don't attempt refresh when offline — let mutation queue retry later
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(() => client(originalRequest));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          if (config.authStrategy === "bearer") {
            const refreshToken = await config.storage.getItem("refresh_token");
            if (refreshToken) {
              const res = await client.post("/auth/refresh", { refreshToken });
              await config.storage.setItem(
                "access_token",
                res.data.accessToken,
              );
              if (res.data.refreshToken) {
                await config.storage.setItem(
                  "refresh_token",
                  res.data.refreshToken,
                );
              }
            }
          } else {
            await client.post("/auth/refresh", {});
          }

          processQueue(null);
          config.onRefreshSuccess?.();
          return client(originalRequest);
        } catch (refreshError) {
          const msg =
            refreshError instanceof Error
              ? refreshError.message
              : String(refreshError);
          logger.error(`[API] Token refresh failed: ${msg}`);
          processQueue(refreshError);
          // Only logout if online — offline users keep their session
          if (typeof navigator !== "undefined" && navigator.onLine) {
            config.onLogout?.();
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );

  /**
   * Proactive silent refresh that respects the isRefreshing guard.
   * Safe to call from timers/visibility handlers — will no-op if a
   * reactive refresh (from a 401 interceptor) is already in flight.
   */
  function silentRefresh(): Promise<void> {
    if (isRefreshing) return refreshPromise ?? Promise.resolve();
    isRefreshing = true;

    refreshPromise = (async () => {
      if (config.authStrategy === "bearer") {
        const refreshToken = await config.storage.getItem("refresh_token");
        if (!refreshToken) return;
        const res = await client.post("/auth/refresh", { refreshToken });
        await config.storage.setItem("access_token", res.data.accessToken);
        if (res.data.refreshToken) {
          await config.storage.setItem("refresh_token", res.data.refreshToken);
        }
      } else {
        await client.post("/auth/refresh", {});
      }
      processQueue(null);
      config.onRefreshSuccess?.();
    })()
      .catch((err) => {
        processQueue(err);
        throw err;
      })
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });

    return refreshPromise;
  }

  (client as ApiClient).silentRefresh = silentRefresh;

  return client as ApiClient;
}

export function workspacePath(workspaceId: string, path: string): string {
  return `/workspaces/${workspaceId}${path}`;
}
