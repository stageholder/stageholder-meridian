/**
 * Meridian pricing in the currency the active ORG is billed in.
 *
 * `usePricing()` answers in the visitor's geo-guessed currency, but Polar
 * charges in the org's billing currency (its subscription row's currency,
 * seeded from the org's country). Showing `usePricing()` alone meant an
 * Indonesian account could see $4.99 on the plan picker and be charged in
 * IDR at checkout. `GET /api/billing/pricing/:product/for/:orgId` (Hub; not
 * wrapped by the SDK yet) answers in the org's currency — same port as
 * Atlas's `lib/billing/hub-billing.ts`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  createAuthenticatedFetch,
  usePricing,
  type PricingResponse,
} from "@stageholder/sdk/spa";
import { spaConfig } from "@/lib/spa-config";

const PRODUCT = "meridian";

/** Hub API origin — the OIDC issuer without its `/oidc` suffix. */
function hubApiBase(): string {
  return spaConfig.issuerUrl.replace(/\/oidc\/?$/, "");
}

let authedFetch: typeof fetch | null = null;

async function hubGet<T>(path: string): Promise<T> {
  authedFetch ??= createAuthenticatedFetch();
  const res = await authedFetch(`${hubApiBase()}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Hub ${path} answered ${res.status}`);
  return (await res.json()) as T;
}

/**
 * With an org: ONLY the org-scoped answer (an error beats showing prices the
 * checkout won't charge). Without one (still resolving): visitor pricing.
 */
export function useOrgPricing(orgId: string | undefined) {
  const generic = usePricing(PRODUCT);
  const scoped = useQuery({
    queryKey: ["stageholder", "pricing", PRODUCT, "org", orgId],
    queryFn: () =>
      hubGet<PricingResponse>(
        `/api/billing/pricing/${PRODUCT}/for/${encodeURIComponent(orgId!)}`,
      ),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
  return orgId
    ? {
        data: scoped.data,
        isLoading: scoped.isLoading,
        isError: scoped.isError,
      }
    : {
        data: generic.data,
        isLoading: generic.isLoading,
        isError: generic.isError,
      };
}

/** The org's Meridian subscription row in the Hub — what the token lacks. */
export interface HubOrgSubscription {
  product: string | null;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean | null;
}

/**
 * Renewal / trial-end date and pending cancellation for the billing page.
 * The access-token claim carries neither, so a customer who cancelled in the
 * Polar portal saw no sign of it in Meridian. Refetches on window focus, so
 * returning from the portal shows the new state.
 */
export function useHubOrgSubscription(orgId: string | undefined) {
  return useQuery({
    queryKey: ["stageholder", "hub-subscription", PRODUCT, orgId],
    queryFn: async () => {
      const rows = await hubGet<HubOrgSubscription[]>(
        `/api/billing/subscriptions/${encodeURIComponent(orgId!)}`,
      );
      return rows.find((r) => r.product === PRODUCT) ?? null;
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}
