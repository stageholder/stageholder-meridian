"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePaywall } from "@stageholder/sdk/react";
import type { UsePaywallResult } from "@stageholder/sdk/react";
import { MeridianPaywallModal } from "@/components/billing/meridian-paywall-modal";

/**
 * Meridian-specific 402 response body shape. The Meridian API returns this
 * on over-cap create calls so the BFF and client can render an informed
 * paywall rather than a generic upgrade prompt.
 */
interface Api402Body {
  code: string;
  feature: string;
  /** Human label for `feature` (e.g. "habits"). API source of truth. */
  featureLabel?: string;
  limit: number;
  current: number;
  /**
   * Plan slug to upgrade to. Set by `enforceLimit` on the API side via the
   * `MERIDIAN_UPGRADE_PLAN_SLUG` env var. Falls back below if absent.
   */
  suggestedPlan?: string;
  /** Human label for `suggestedPlan` (e.g. "Unlimited"). API source of truth. */
  suggestedPlanName?: string;
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
        featureLabel: detail.featureLabel,
        currentLimit: detail.limit,
        product: "meridian",
        // Plan slug from the API's 402 body (server is source of truth for the
        // upgrade path). Falls back to `meridian-unlimited` only if the API
        // didn't include one — that's our canonical paid tier slug.
        suggestedPlan: detail.suggestedPlan ?? "meridian-unlimited",
        suggestedPlanName: detail.suggestedPlanName,
      });
    }

    window.addEventListener(MERIDIAN_PAYWALL_EVENT, handler);
    return () => window.removeEventListener(MERIDIAN_PAYWALL_EVENT, handler);
  }, [paywall]);

  return (
    <PaywallControllerContext.Provider value={paywall}>
      {/* Meridian-custom modal — built on Radix Dialog directly, NOT
          on `<PaywallModal>` from the SDK. State machine still flows
          from the SDK's `usePaywall()`; only the presentation is
          owned by Meridian so it can light up the gated pillar
          (todos / habits / journal) in the orbital diagram and match
          the editorial language of the billing/upgrade pages. */}
      <MeridianPaywallModal
        open={paywall.isOpen}
        onOpenChange={(o) => !o && paywall.close()}
        reason={paywall.reason}
      />
      {children}
    </PaywallControllerContext.Provider>
  );
}
