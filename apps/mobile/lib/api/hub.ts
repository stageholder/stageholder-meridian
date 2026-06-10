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
//
// Profile WRITES stay on the SDK's native useUpdateProfile (it refreshes the
// session afterwards so useUser's name/picture update — don't bypass it).

import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";

import { getAccessToken } from "./auth";

/** Hub base URL — same env the StageholderProvider boots from. */
function resolveHubUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
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
  config.baseURL = resolveHubUrl();
  const token = await getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

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
};

export function useHubProfile() {
  return useQuery({
    queryKey: hubKeys.profile,
    queryFn: async () => {
      const { data } = await hubClient.get<HubProfile>("/api/account/profile");
      return data;
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
