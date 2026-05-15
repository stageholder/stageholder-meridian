/**
 * Structural API-client interface shared across `@repo/core/api/*`
 * factories. Implementations: axios `AxiosInstance` (mobile, server),
 * SDK SPA `ServiceWrapper` (web pwa, desktop). The factories only call
 * `get/post/put/patch/delete` and read `res.data` — that's the contract.
 *
 * Defaults match axios: `<T = any>` for permissive `res.data` typing so
 * existing call sites that don't specify a type don't break.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ApiClientLike {
  get<T = any>(
    path: string,
    config?: { params?: Record<string, unknown>; signal?: AbortSignal },
  ): Promise<{ data: T }>;
  post<T = any>(
    path: string,
    data?: unknown,
    config?: { signal?: AbortSignal },
  ): Promise<{ data: T }>;
  put<T = any>(
    path: string,
    data?: unknown,
    config?: { signal?: AbortSignal },
  ): Promise<{ data: T }>;
  patch<T = any>(
    path: string,
    data?: unknown,
    config?: { signal?: AbortSignal },
  ): Promise<{ data: T }>;
  delete<T = any>(
    path: string,
    config?: { signal?: AbortSignal; data?: unknown },
  ): Promise<{ data: T }>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Legacy alias — kept exported so older callers (`type ApiClient`) keep
 * compiling during the SPA cutover. Prefer importing `ApiClientLike` in
 * new code.
 */
export type ApiClient = ApiClientLike;

/**
 * No-op refresh helper retained for backwards compatibility. Refresh is
 * handled inside the SDK fetch wrapper (web/desktop) or the platform-
 * specific interceptor (mobile) — never from this module.
 */
export function waitForRefresh(): Promise<void> {
  return Promise.resolve();
}
