"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePaywall, PaywallModal } from "@stageholder/sdk/react";
import type { UsePaywallResult } from "@stageholder/sdk/react";

/**
 * Meridian-specific 402 response body shape. The Meridian API returns this
 * on over-cap create calls so the BFF and client can render an informed
 * paywall rather than a generic upgrade prompt.
 */
interface Api402Body {
  code: string;
  feature: string;
  limit: number;
  current: number;
}

/**
 * Custom DOM event dispatched by the API client (`lib/api-client.ts`) when
 * a 402 response is received from the Meridian API. The listener picks it up
 * and calls `paywall.open(...)` so the SDK `<PaywallModal>` renders.
 *
 * @see `lib/api-client.ts` — the 402 response interceptor.
 */
export const MERIDIAN_PAYWALL_EVENT = "meridian:paywall";

// ─── Paywall controller context ──────────────────────────────────────────────

/**
 * Context that exposes the shared `usePaywall()` result to any descendant
 * that needs to programmatically open the paywall (e.g. a gated action
 * button deep in the tree). Lift `usePaywall` once here so state is shared.
 */
const PaywallControllerContext = createContext<UsePaywallResult | null>(null);

/**
 * Read the shared paywall controller. Must be called inside
 * `<PaywallListener>` (which renders the `PaywallControllerContext.Provider`).
 *
 * @throws When called outside `<PaywallListener>`.
 */
export function usePaywallController(): UsePaywallResult {
  const ctx = useContext(PaywallControllerContext);
  if (!ctx) {
    throw new Error(
      "usePaywallController() must be called inside <PaywallListener>.",
    );
  }
  return ctx;
}

// ─── PaywallListener ─────────────────────────────────────────────────────────

interface PaywallListenerProps {
  children?: ReactNode;
}

/**
 * Listens for `meridian:paywall` CustomEvents dispatched by the API client
 * when the Meridian API returns HTTP 402. On receipt, calls
 * `usePaywall().open({ feature, currentLimit, suggestedPlan })` so the SDK
 * `<PaywallModal>` renders.
 *
 * Also provides `PaywallControllerContext` so deep children can open the
 * paywall programmatically without prop-drilling.
 *
 * Mount once at the root layout level, inside `<StageholderProvider>`.
 */
export function PaywallListener({ children }: PaywallListenerProps) {
  const paywall = usePaywall();

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<Api402Body>).detail;
      paywall.open({
        feature: detail.feature,
        currentLimit: detail.limit,
        product: "meridian",
        // suggestedPlan is not part of the 402 body; the hub determines the
        // correct next tier. Default to "team" as the canonical upgrade target
        // for Meridian's free-tier users. This can be made dynamic once the
        // subscription claim is wired through useSubscription().
        suggestedPlan: "team",
      });
    }

    window.addEventListener(MERIDIAN_PAYWALL_EVENT, handler);
    return () => window.removeEventListener(MERIDIAN_PAYWALL_EVENT, handler);
  }, [paywall]);

  return (
    <PaywallControllerContext.Provider value={paywall}>
      <PaywallModal
        open={paywall.isOpen}
        onOpenChange={(o) => !o && paywall.close()}
        reason={paywall.reason}
      />
      {children}
    </PaywallControllerContext.Provider>
  );
}
