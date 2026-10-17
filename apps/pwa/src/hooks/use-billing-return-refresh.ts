import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useRefreshSession,
  useStageholder,
  useSubscription,
} from "@stageholder/sdk/spa";
import { isDesktop } from "@repo/core/platform";
import {
  bustBillingCaches,
  consumeBillingReturnPending,
} from "@/lib/billing-return";

/** After a billing return: re-rotate the token until the claim moves (~30 s). */
const SETTLE_ATTEMPTS = 15;
const SETTLE_INTERVAL_MS = 2_000;

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
 * Polar sends the browser back to `/billing/complete` BEFORE its webhook has
 * updated the Hub's subscription row, and a user who switches straight back
 * to the app beats it. So, like the web success page, the rotation repeats
 * every couple of seconds until the subscription claim changes from the one
 * the user left on (new plan, trial, cancellation…), bounded at ~30 s — a
 * cancelled checkout or a look-only portal visit just costs those retries.
 *
 * The pending flag is read-and-cleared, so this runs once per billing action,
 * not on every focus. Mount once, high in the authenticated tree (the app
 * shell).
 */
export function useBillingReturnRefresh(): void {
  const refreshSession = useRefreshSession();
  const { refreshSession: rotateSession } = useStageholder();
  const queryClient = useQueryClient();
  const sub = useSubscription();

  // Stable refs so the focus listener isn't re-subscribed every render. The
  // refresh ROTATES the token (the plan lives in its claims) and then flushes
  // the SDK's cached reads — `useRefreshSession()` alone never re-mints it.
  const refreshRef = useRef(async () => {});
  refreshRef.current = async () => {
    await rotateSession();
    await refreshSession.mutateAsync();
  };
  const subRef = useRef(sub);
  subRef.current = sub;

  useEffect(() => {
    if (!isDesktop()) return;

    let running = false;
    let unmounted = false;
    const fingerprint = () => JSON.stringify(subRef.current ?? null);

    async function runIfPending() {
      if (running) return;
      if (!consumeBillingReturnPending()) return;
      running = true;
      const before = fingerprint();
      try {
        await Promise.all([
          refreshRef.current(),
          bustBillingCaches(queryClient),
        ]);
        let waited = false;
        for (
          let attempt = 0;
          attempt < SETTLE_ATTEMPTS && !unmounted && fingerprint() === before;
          attempt++
        ) {
          waited = true;
          await new Promise((r) => setTimeout(r, SETTLE_INTERVAL_MS));
          if (!unmounted) await refreshRef.current();
        }
        if (waited && !unmounted) await bustBillingCaches(queryClient);
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
      unmounted = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);
}
