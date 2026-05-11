// apps/mobile/lib/api/client.ts
//
// Axios client for the Meridian REST API. One shared instance, configured
// with the base URL from env + auth interceptor that attaches the SDK's
// access token to every request.
//
// Response interceptors:
//   - 402 (Payment Required)  → dispatch a paywall event the UI can listen
//                               for. Re-throws so the calling mutation still
//                               rejects and no optimistic commit leaks.
//   - 401 (Unauthorized)      → call the configured onLogout callback. The
//                               SDK should already have tried to refresh
//                               before we got here, so a 401 means the
//                               session is genuinely dead.
//
// This mirrors apps/pwa/lib/api-client.ts's shape so devs working across
// both surfaces see the same conventions.

import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import { DeviceEventEmitter } from "react-native";

import { getAccessToken } from "./auth";

/** Resolve the API base URL — env first, then app.json extra fallback. */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_MERIDIAN_API_URL;
  if (fromEnv) return fromEnv;
  const fromExtra = Constants.expoConfig?.extra?.meridianApiUrl as
    | string
    | undefined;
  if (fromExtra) return fromExtra;
  // Fail loud rather than fall back silently — a wrong/missing API URL is
  // worth a clear error on the first request.
  throw new Error(
    "[meridian/api] EXPO_PUBLIC_MERIDIAN_API_URL is not set. Add it to " +
      ".env.local (or app.json's `extra.meridianApiUrl`) and restart Metro.",
  );
}

export type ApiClient = AxiosInstance;

/**
 * Events the client dispatches via DeviceEventEmitter so the rest of the
 * app can react without taking a direct dependency on Axios. Subscribe via:
 *
 *   DeviceEventEmitter.addListener("meridian:paywall", (detail) => {...})
 *   DeviceEventEmitter.addListener("meridian:unauthorized", () => {...})
 *
 * (Mirrors the PWA's `window.dispatchEvent("meridian:paywall", …)` pattern.)
 */
export const ClientEvents = {
  paywall: "meridian:paywall",
  unauthorized: "meridian:unauthorized",
} as const;

/**
 * Build a configured Axios instance. Exposed as a factory (not a singleton
 * import) so tests can construct fresh clients without mocking modules.
 */
export function createMeridianClient(): ApiClient {
  const client = axios.create({
    baseURL: resolveBaseUrl(),
    headers: { "Content-Type": "application/json" },
    // 10s feels right for mobile networks — long enough for slow 3G,
    // short enough that the UI can show a sensible "still trying…" hint.
    timeout: 10_000,
  });

  // Request: attach Bearer token. Runs on every outgoing request; if no
  // token is available, the request goes out unauthenticated and the
  // server returns 401 (handled below).
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await getAccessToken();
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
      return config;
    },
  );

  // Response: paywall + unauthorized signals.
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 402) {
          const body = error.response?.data as
            | { code?: string; feature?: string; limit?: number }
            | undefined;
          if (
            body?.code === "limit_reached" &&
            body.feature &&
            typeof body.limit === "number"
          ) {
            DeviceEventEmitter.emit(ClientEvents.paywall, {
              feature: body.feature,
              limit: body.limit,
            });
          }
        }

        if (status === 401) {
          DeviceEventEmitter.emit(ClientEvents.unauthorized);
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}

/**
 * Shared client instance. Most callers should import this; only tests
 * (or code that genuinely needs an isolated client) should call the
 * factory directly.
 */
export const apiClient: ApiClient = createMeridianClient();
