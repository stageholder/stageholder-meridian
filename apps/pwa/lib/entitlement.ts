import { db, type EntitlementCache } from "@repo/offline/db";
import { logger } from "@repo/core/platform/logger";

/**
 * Fetch the current user's entitlement (plan + limits) from the Meridian
 * API and cache it in Dexie for offline-access reads. The UI uses the
 * cache to render the paywall; the server is still authoritative on
 * writes (it returns 402 on over-cap create calls).
 */
export async function refreshEntitlement(userSub: string): Promise<void> {
  try {
    const res = await fetch("/api/v1/me/entitlement", {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as Omit<
      EntitlementCache,
      "userSub" | "updatedAt"
    >;
    await db.entitlementCache.put({
      userSub,
      ...data,
      updatedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[Entitlement] refresh failed: ${message}`);
  }
}

export async function getCachedEntitlement(
  userSub: string,
): Promise<EntitlementCache | undefined> {
  return db.entitlementCache.get(userSub);
}
