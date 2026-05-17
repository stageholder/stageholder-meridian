import { useEffect, type ReactNode } from "react";
import { usePaywall } from "@stageholder/sdk/spa";
import type { PaywallReason } from "@stageholder/sdk/core";
import { MeridianPaywallModal } from "@/components/billing/meridian-paywall-modal";

/**
 * Meridian-specific 402 response body shape. The API returns this on
 * over-cap create calls so the client can render an informed paywall
 * rather than a generic upgrade prompt. ServiceWrapper inspects 402
 * responses and dispatches `MERIDIAN_PAYWALL_EVENT` with this shape.
 */
interface Api402Body {
  code: string;
  feature: string;
  featureLabel?: string;
  limit: number;
  current: number;
  suggestedPlan?: string;
  suggestedPlanName?: string;
}

/**
 * Window event the API client (`utils/service-wrapper.ts`) dispatches
 * on every 402 response. The Meridian API uses 402 (not Hub's 403
 * `PLAN_UPGRADE_REQUIRED`), so the SDK's auto-paywall — which only
 * fires inside the SDK's internal client — doesn't see it. This
 * listener bridges the meridian:paywall window event into the SDK's
 * `usePaywall()` controller.
 */
export const MERIDIAN_PAYWALL_EVENT = "meridian:paywall";
// Type intentionally exported so call sites can import the 402 body shape.
export type { Api402Body as MeridianPaywallDetail };

/**
 * Bridges Meridian's `meridian:paywall` window event into the SDK's
 * paywall controller AND renders the bespoke `<MeridianPaywallModal>`.
 *
 * Mount once near the root (App.tsx). Because the SDK's
 * `<StageholderSpaProvider>` is configured with `renderPaywall: false`,
 * this component is the only mount of a paywall modal in the tree.
 */
export function PaywallListener({ children }: { children?: ReactNode }) {
  const paywall = usePaywall();

  // ServiceWrapper dispatches `meridian:paywall` on every 402 — convert
  // the Meridian-flavored body to a PaywallReason and open the modal.
  useEffect(() => {
    function onPaywallEvent(e: Event) {
      const detail = (e as CustomEvent<Api402Body>).detail;
      if (!detail) return;
      const reason: PaywallReason = {
        feature: detail.feature,
        ...(detail.featureLabel && { featureLabel: detail.featureLabel }),
        ...(typeof detail.limit === "number" && { currentLimit: detail.limit }),
        ...(detail.suggestedPlan && { suggestedPlan: detail.suggestedPlan }),
        ...(detail.suggestedPlanName && {
          suggestedPlanName: detail.suggestedPlanName,
        }),
      };
      paywall.open(reason);
    }
    window.addEventListener(MERIDIAN_PAYWALL_EVENT, onPaywallEvent);
    return () =>
      window.removeEventListener(MERIDIAN_PAYWALL_EVENT, onPaywallEvent);
  }, [paywall]);

  return (
    <>
      <MeridianPaywallModal
        open={paywall.isOpen}
        onOpenChange={(o) => !o && paywall.close()}
        reason={paywall.reason}
      />
      {children}
    </>
  );
}
