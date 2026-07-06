// apps/mobile/lib/api/hub.ts
//
// Hub (Stageholder identity/billing) REST hooks for the surfaces the
// react-native SDK entry doesn't ship yet: profile READ, invoices, and the
// billing portal. The SPA SDK has useProfile/useInvoices/useBillingPortal,
// but those read the SPA provider's context (dual-package hazard) — so
// mobile talks to the same Hub endpoints directly with the SDK's Bearer
// token (the exact endpoints the SPA bundle calls):
//
//   GET  /api/account/profile                      → Profile
//   GET  /api/billing/invoices/:orgId              → Invoice[]
//   GET  /api/billing/invoices/:orgId/:orderId/url → { url }   (hosted invoice)
//   POST /api/billing/portal/:orgId                → { url }   (Polar portal)
//   GET  /api/billing/pricing/:product             → { plans, features }
//
// Profile WRITES stay on the SDK's native useUpdateProfile (it refreshes the
// session afterwards so useUser's name/picture update — don't bypass it).

import { useMutation, useQuery } from "@tanstack/react-query";
// Type-only import from the SPA entry — erased at compile time, so Metro
// never loads the web bundle. Keeps the pricing shapes in lockstep with the
// SDK instead of hand-copying the (large) PricingPlan interface.
import type { PricingPlan, ProductFeature } from "@stageholder/sdk/spa";
import axios from "axios";
import { DeviceEventEmitter } from "react-native";

import { getAccessToken } from "./auth";
import { ClientEvents } from "./client";

/**
 * The Hub ORIGIN (no `/oidc` mount). The issuer URL carries the `/oidc` mount
 * path (oidc-provider lives there), but the Hub's REST API AND its web account
 * pages are served at the origin root — so both `<origin>/api/...` and
 * `<origin>/account` need the bare origin, not `<origin>/oidc/...` (which 404s).
 * Exported so screens that link to Hub web pages (Settings → Security) resolve
 * the same origin the REST client uses, instead of hand-rolling it.
 */
export function hubOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "").replace(/\/oidc$/, "");
  }
  throw new Error(
    "[meridian/hub] EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL is not set — the " +
      "billing/profile screens need the Hub origin.",
  );
}

const hubClient = axios.create({
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
});
hubClient.interceptors.request.use(async (config) => {
  // Resolved per request (not at module load) so a missing env fails the
  // screen that needs it, not the whole app at import time.
  config.baseURL = hubOrigin();
  const token = await getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});
// A 401 on a Hub call (billing/profile) is the same dead-session signal the
// main API client emits — surface it the same way so the app redirects to
// sign-in instead of silently erroring on a billing screen.
hubClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      DeviceEventEmitter.emit(ClientEvents.unauthorized);
    }
    return Promise.reject(error);
  },
);

/* ------------------------------- Types ------------------------------- */

/** Subset of Hub's account profile we render (full shape: SDK `Profile`). */
export interface HubProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string | null;
  language: string | null;
}

/** Subset of the SDK `Invoice` (Polar order) shape the ledger renders. */
export interface HubInvoice {
  id: string;
  billingReason: string;
  status: string;
  statusFormatted: string;
  totalFormatted: string;
  refunded: boolean;
  createdAt: string;
}

/** Mirrors the SDK's role gate: only owners/admins may touch billing. */
export function canManageBilling(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/* ------------------------------- Hooks ------------------------------- */

export const hubKeys = {
  profile: ["hub", "profile"] as const,
  invoices: (orgId: string | undefined) => ["hub", "invoices", orgId] as const,
  pricing: (product: string) => ["hub", "pricing", product] as const,
};

/** Response of `GET /api/billing/pricing/:product` (SDK `PricingResponse`). */
export interface HubPricing {
  plans: PricingPlan[];
  features: ProductFeature[];
}

/**
 * The Hub's pricing catalog (plans + feature definitions) — what the SPA
 * SDK's `usePricing("meridian")` reads. Mobile uses it for the feature
 * COMPARISON only; the purchasable prices on /upgrade stay the store's
 * (RevenueCat) localized prices — App Store / Play are the merchant of
 * record there, not Polar.
 */
export function useHubPricing(product = "meridian") {
  return useQuery({
    queryKey: hubKeys.pricing(product),
    queryFn: async () => {
      const { data } = await hubClient.get<HubPricing>(
        `/api/billing/pricing/${encodeURIComponent(product)}`,
      );
      return data;
    },
    // The catalog changes on deploys, not sessions — cache generously.
    staleTime: 5 * 60 * 1000,
  });
}

export function useHubProfile() {
  return useQuery({
    queryKey: hubKeys.profile,
    queryFn: async () => {
      const { data } = await hubClient.get<HubProfile>("/api/account/profile");
      return data;
    },
    // 4xx are deterministic (404 = no profile row yet on a fresh account;
    // 401 = session problem) — retrying just delays the UI's error/fallback
    // state. Only transient 5xx/network errors get the default retries.
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}

export function useInvoices(orgId: string | undefined) {
  return useQuery({
    queryKey: hubKeys.invoices(orgId),
    queryFn: async () => {
      const { data } = await hubClient.get<HubInvoice[]>(
        `/api/billing/invoices/${encodeURIComponent(orgId!)}`,
      );
      return data;
    },
    enabled: Boolean(orgId),
  });
}

/** Hosted-invoice URL for one order — Hub returns `{url}` JSON, not a
 *  redirect, so callers fetch then hand the URL to the system browser. */
export async function fetchInvoiceUrl(
  orgId: string,
  orderId: string,
): Promise<string | undefined> {
  const { data } = await hubClient.get<{ url?: string }>(
    `/api/billing/invoices/${encodeURIComponent(orgId)}/${encodeURIComponent(orderId)}/url`,
  );
  return data.url;
}

/** Open a Polar billing-portal session — resolves the portal URL to hand to
 *  the system browser (manage payment method, cancel, change plan). */
export function useBillingPortal() {
  return useMutation({
    mutationFn: async (input: { orgId: string }) => {
      const { data } = await hubClient.post<{
        portalUrl?: string;
        url?: string;
      }>(`/api/billing/portal/${encodeURIComponent(input.orgId)}`, {});
      const url = data.portalUrl ?? data.url;
      if (!url) throw new Error("billing portal response missing url");
      return { url };
    },
  });
}
