import axios, { type AxiosInstance } from "axios";
import type { PlatformConfig } from "@repo/core/platform";

export type ApiClient = AxiosInstance;

// Session refresh is handled server-side now:
// - Web:     the Next.js BFF proxy at /api/v1/[...path] inspects the
//            iron-session cookie and refreshes the OIDC access token
//            transparently before every upstream call.
// - Desktop: apps/pwa/lib/api-client.ts installs a request interceptor
//            that calls getAccessTokenTauri(), which refreshes against
//            the Hub using the refresh token stored in Tauri's plugin-store.
// The client-side `silentRefresh()` loop that used to live here is
// obsolete — kept a no-op export only for any straggler callers. The
// previous `/auth/refresh` path was deleted with the rest of the local
// auth module in Group 2.
export function waitForRefresh(): Promise<void> {
  return Promise.resolve();
}

export function createApiClient(config: PlatformConfig): ApiClient {
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    headers: { "Content-Type": "application/json" },
    withCredentials: config.authStrategy === "cookie",
  });

  // Response interceptor:
  //   402 → fire the paywall event so the UI can render the upgrade modal
  //         (then re-throw so the triggering mutation still rejects and
  //          no optimistic UI commit leaks through)
  //   401 → give up and tell the caller to log the user out. The BFF
  //         (or the desktop auth shim) would have already tried to
  //          refresh before we ever got a 401; retrying from here would
  //          just 404 against endpoints that no longer exist.
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;

      if (status === 402 && typeof window !== "undefined") {
        const body = error.response.data;
        if (
          body?.code === "limit_reached" &&
          body.feature &&
          typeof body.limit === "number"
        ) {
          window.dispatchEvent(
            new CustomEvent("meridian:paywall", {
              detail: { feature: body.feature, limit: body.limit },
            }),
          );
        }
      }

      if (status === 401) {
        // Offline-safe: don't log out if the browser says we're offline;
        // the mutation queue will retry once we're back online.
        if (typeof navigator === "undefined" || navigator.onLine) {
          config.onLogout?.();
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}
