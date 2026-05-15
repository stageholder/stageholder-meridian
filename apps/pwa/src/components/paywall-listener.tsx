import { type ReactNode } from "react";
import { usePaywall, type UsePaywallResult } from "@/lib/sdk-compat";
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
 * on every 402 response. `<PaywallProvider>` in `sdk-compat.tsx` is
 * already subscribed; the legacy export name is preserved so existing
 * call sites keep compiling.
 */
export const MERIDIAN_PAYWALL_EVENT = "meridian:paywall";
// Type intentionally exported so call sites can import the 402 body shape.
export type { Api402Body as MeridianPaywallDetail };

/**
 * Legacy alias for callers that imported `usePaywallController`. Points
 * at the SPA-compatible paywall controller in `@/lib/sdk-compat` — same
 * shape, no SDK `/react`-context dependency (avoids the dual-package
 * hazard the original setup hit under SPA mode).
 */
export function usePaywallController(): UsePaywallResult {
  return usePaywall();
}

/**
 * Renders the meridian paywall modal driven by the shared `usePaywall()`
 * controller from `sdk-compat`. The controller itself owns the
 * window-event subscription (in `<PaywallProvider>`); this component
 * just paints the modal off the controller's state.
 *
 * Mount once near the root (App.tsx) inside `<PaywallProvider>`.
 */
export function PaywallListener({ children }: { children?: ReactNode }) {
  const paywall = usePaywall();
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
