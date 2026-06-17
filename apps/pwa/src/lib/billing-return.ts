import type { QueryClient } from "@tanstack/react-query";
import { isDesktop } from "@repo/core/platform";
import { openURL } from "@repo/core/platform/linking";
import { refreshEntitlement } from "@/lib/entitlement";
import { tryGetCurrentUserSub } from "@/lib/current-user-sub";

/**
 * Desktop billing-return plumbing.
 *
 * On web, Polar checkout / the billing portal open in the SAME tab and
 * redirect back to an auth-gated success route inside the app — the existing
 * `/settings/billing/success` flow handles rotate + cache-bust in-page.
 *
 * On desktop (Tauri), `openURL` now hands those external URLs to the SYSTEM
 * BROWSER (see `@repo/core/platform/linking`). Two consequences this module
 * handles:
 *
 *  1. The browser can't load `tauri://localhost/...`, and the web success
 *     route is auth-gated (a logged-out browser would bounce to login). So
 *     desktop return URLs must point at the PUBLIC web page `/billing/complete`
 *     (browser-reachable, no session required) — see `billingReturnUrl`.
 *  2. The desktop app itself never visits that page, so it learns about the
 *     new plan via a focus-triggered refresh after the user returns — see
 *     `markBillingReturnPending` / `useBillingReturnRefresh`.
 */

/** Public, auth-free web page Polar redirects the system browser to on desktop. */
const DESKTOP_RETURN_PATH = "/billing/complete";

/**
 * Build the `returnUrl` handed to Polar for a checkout / portal session.
 *
 * - **Web**: `${origin}${webPath}` — same tab, lands on the in-app route.
 * - **Desktop**: the public web completion page on the real https origin
 *   (`VITE_PUBLIC_APP_URL`), which the system browser can actually render.
 *   `webPath` is ignored — the desktop app reflects the change on its own via
 *   the focus refresh, so all desktop billing returns share one public page.
 */
export function billingReturnUrl(webPath: string): string {
  if (isDesktop()) {
    const base = import.meta.env.VITE_PUBLIC_APP_URL ?? "";
    return `${base}${DESKTOP_RETURN_PATH}`;
  }
  return `${window.location.origin}${webPath}`;
}

// Module-level flag: a desktop billing action is in flight in the system
// browser. The desktop app stays mounted while the user is away (it doesn't
// unload), so a plain boolean survives the round-trip. No-op on web.
let billingReturnPending = false;

/** Mark that the user just left to the system browser for a billing action. */
export function markBillingReturnPending(): void {
  billingReturnPending = true;
}

/**
 * Read-and-clear the pending flag. Returns true at most once per billing
 * action, so the focus handler runs the (idempotent) recovery exactly once
 * per return rather than on every window focus.
 */
export function consumeBillingReturnPending(): boolean {
  if (!billingReturnPending) return false;
  billingReturnPending = false;
  return true;
}

/**
 * Open an external billing URL (Polar checkout / portal) and arm the desktop
 * focus refresh. On web this is just `openURL` — the flag is harmless and the
 * focus hook is desktop-only.
 */
export function openBillingURL(url: string): void {
  markBillingReturnPending();
  openURL(url);
}

/**
 * Bust the local billing caches: Meridian's in-memory entitlement cache plus
 * the React Query billing/invoice/subscription/entitlement queries. Mirrors
 * the predicate in `routes/_app/settings/billing/success.tsx` — keep the two
 * key heads in sync if either changes.
 */
export async function bustBillingCaches(
  queryClient: QueryClient,
): Promise<void> {
  const userSub = tryGetCurrentUserSub();
  if (userSub) {
    await refreshEntitlement(userSub);
  }
  await queryClient.invalidateQueries({
    predicate: (q) => {
      const key = q.queryKey;
      if (!Array.isArray(key)) return false;
      const head = key[0];
      return (
        head === "billing" ||
        head === "invoices" ||
        head === "subscriptions" ||
        head === "entitlement"
      );
    },
  });
}
