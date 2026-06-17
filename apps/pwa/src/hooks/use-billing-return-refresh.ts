import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRefreshSession } from "@stageholder/sdk/spa";
import { isDesktop } from "@repo/core/platform";
import {
  bustBillingCaches,
  consumeBillingReturnPending,
} from "@/lib/billing-return";

/**
 * Desktop-only: reflect a billing change after the user pays in the system
 * browser. Web doesn't need this — checkout/portal there happen in the same
 * tab and return to the in-app `/settings/billing/success` route, which runs
 * the rotate/bust itself.
 *
 * When a billing action is opened on desktop, `openBillingURL` arms a pending
 * flag. The app then loses focus (the browser takes over). On the user's
 * return, the first window focus / tab-visible event runs the same recovery
 * the web success page does:
 *
 *   1. `refreshSession()` — rotate the access token so the new `subscriptions`
 *      claim lands (the canonical update already happened server-side via
 *      Polar's webhook → Hub).
 *   2. `bustBillingCaches()` — drop the in-memory entitlement cache + the
 *      React Query billing queries so every gated limit reflects the new plan
 *      without waiting for stale-time.
 *
 * The pending flag is read-and-cleared, so this runs once per billing action,
 * not on every focus. It's idempotent, so a cancelled checkout (flag set, no
 * actual change) just costs one harmless refresh. Mount once, high in the
 * authenticated tree (the app shell).
 */
export function useBillingReturnRefresh(): void {
  const refreshSession = useRefreshSession();
  const queryClient = useQueryClient();

  // Stable refs — `useRefreshSession()` returns a fresh object each render;
  // capturing it directly would re-subscribe the listener on every render.
  const refreshRef = useRef(refreshSession.mutateAsync);
  refreshRef.current = refreshSession.mutateAsync;

  useEffect(() => {
    if (!isDesktop()) return;

    let running = false;
    async function runIfPending() {
      if (running) return;
      if (!consumeBillingReturnPending()) return;
      running = true;
      try {
        await Promise.all([
          refreshRef.current(),
          bustBillingCaches(queryClient),
        ]);
      } catch (e) {
        // Best-effort: bust the local caches even if the Hub-side session
        // rotation failed — the next /auth/me poll picks up the new claim, and
        // the entitlement cache shouldn't keep serving the pre-purchase plan.
        console.error("[meridian:billing-return] refresh failed:", e);
        try {
          await bustBillingCaches(queryClient);
        } catch {
          /* local cache failure is non-fatal */
        }
      } finally {
        running = false;
      }
    }

    const onFocus = () => void runIfPending();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runIfPending();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);
}
