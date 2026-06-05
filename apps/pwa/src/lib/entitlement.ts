import { logger } from "@repo/core/platform/logger";
import { apiClient } from "@/lib/api-client";

/**
 * Current user's entitlement (plan + limits) as returned by the Meridian
 * API. Previously this shape lived in `@repo/offline/db` (it was persisted
 * to Dexie for offline paywall reads). The offline package is gone, so the
 * type is owned here now — the only place that needs it.
 */
export interface Entitlement {
  plan: "meridian-free" | "meridian-unlimited" | string;
  entitled: boolean;
  limits: {
    max_habits: number;
    max_todo_lists: number;
    max_active_todos: number;
  };
}

/**
 * Module-level in-memory entitlement cache, keyed by user sub. This replaces
 * the old Dexie `entitlementCache` table: nothing in the PWA actually reads
 * the cache back today (the paywall is driven by the API's live 402
 * responses), so a process-lifetime in-memory map is sufficient — and it
 * drops the last offline-storage dependency from this module. If a future
 * feature needs cross-reload persistence, promote this to react-query or
 * localStorage rather than re-introducing Dexie.
 */
const entitlementBySub = new Map<string, Entitlement>();

/**
 * Fetch the current user's entitlement (plan + limits) from the Meridian
 * API and cache it in memory. The server is still authoritative on writes
 * (it returns 402 on over-cap create calls); this cache exists only so a
 * caller can read the last-known plan without a round-trip.
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
    const res = await apiClient.get<Entitlement>("/me/entitlement");
    entitlementBySub.set(userSub, res.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Transient: the SDK's auth-fetch binding briefly nulls during
    // provider re-binds (state churn around refreshSession, switchOrg,
    // etc.). Not a real failure — the next refresh will retry. Don't
    // alarm the user about a race window the caller can't act on.
    if (message.includes("no StageholderProvider is mounted")) return;
    logger.warn(`[Entitlement] refresh failed: ${message}`);
  }
}

export function getCachedEntitlement(userSub: string): Entitlement | undefined {
  return entitlementBySub.get(userSub);
}
