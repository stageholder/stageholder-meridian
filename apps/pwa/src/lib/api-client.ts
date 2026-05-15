import { ServiceWrapper } from "@/utils/service-wrapper";

const apiBaseUrl = import.meta.env.VITE_API_URL;
if (!apiBaseUrl) {
  throw new Error("VITE_API_URL is required");
}

/**
 * Singleton Meridian API client. Backed by `createAuthenticatedFetch` from
 * `@stageholder/sdk/spa` — the SDK provider attaches Bearer + transparent
 * refresh on every call. 402 responses dispatch a `meridian:paywall`
 * window event; `<PaywallListener>` opens the upgrade modal.
 *
 * Web AND desktop go through this same client now — the previous
 * web/desktop branching (cookie vs Tauri-bearer) is gone. The Tauri shell
 * uses the SDK's `TauriStorageAdapter` (Phase 5) for token persistence;
 * everything above that adapter is identical to web.
 */
const apiClient = new ServiceWrapper(apiBaseUrl);

export { apiClient };
export default apiClient;
