import { db, type EntitlementCache } from "@repo/offline/db";
import { logger } from "@repo/core/platform/logger";
import { apiClient } from "@/lib/api-client";

/**
 * Fetch the current user's entitlement (plan + limits) from the Meridian
 * API and cache it in Dexie for offline-access reads. The UI uses the
 * cache to render the paywall; the server is still authoritative on
 * writes (it returns 402 on over-cap create calls).
 *
 * Uses `apiClient` (bound to VITE_API_URL) rather than a raw `fetch` to
 * a relative path — under the SPA model, a relative `/api/v1/*` resolves
 * to the SPA's own origin (port 4001) and hits Vite's SPA fallback,
 * which returns `index.html` and crashes JSON parsing. The apiClient
 * prefixes the Meridian API origin (port 4000) and injects the bearer
 * token via the SDK's `createAuthenticatedFetch`.
 */
export async function refreshEntitlement(userSub: string): Promise<void> {
  try {
    const res =
      await apiClient.get<Omit<EntitlementCache, "userSub" | "updatedAt">>(
        "/me/entitlement",
      );
    await db.entitlementCache.put({
      userSub,
      ...res.data,
      updatedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Transient: the SDK's auth-fetch binding briefly nulls during
    // provider re-binds (state churn around refreshSession, switchOrg,
    // etc.). Not a real failure — the next sync cycle will retry. Don't
    // alarm the user about a race window the caller can't act on.
    if (message.includes("no StageholderProvider is mounted")) return;
    logger.warn(`[Entitlement] refresh failed: ${message}`);
  }
}

export async function getCachedEntitlement(
  userSub: string,
): Promise<EntitlementCache | undefined> {
  return db.entitlementCache.get(userSub);
}
